import CryptoKit
import Foundation

/// RFC 6455 WebSocket pieces: handshake key, frame encoding, and a streaming frame parser.
public enum WebSocket {
    static let guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    public enum Opcode: UInt8 {
        case continuation = 0x0, text = 0x1, binary = 0x2, close = 0x8, ping = 0x9, pong = 0xA
        var isControl: Bool { rawValue >= 0x8 }
    }

    public struct Frame: Equatable {
        public var fin: Bool
        public var opcode: Opcode
        public var payload: [UInt8]
    }

    public static func acceptKey(for clientKey: String) -> String {
        let digest = Insecure.SHA1.hash(data: Data((clientKey.trimmingCharacters(in: .whitespaces) + guid).utf8))
        return Data(digest).base64EncodedString()
    }

    /// Server frames are never masked.
    public static func encode(_ opcode: Opcode, _ payload: [UInt8], fin: Bool = true) -> [UInt8] {
        encode(opcode, payload, fin: fin, mask: nil)
    }

    /// Client-style masked frame (used by tests and the benchmark client).
    public static func encode(_ opcode: Opcode, _ payload: [UInt8], fin: Bool = true, mask: [UInt8]?) -> [UInt8] {
        var out: [UInt8] = [(fin ? 0x80 : 0) | opcode.rawValue]
        let maskBit: UInt8 = mask == nil ? 0 : 0x80
        let n = payload.count
        if n < 126 {
            out.append(maskBit | UInt8(n))
        } else if n <= 0xFFFF {
            out.append(maskBit | 126)
            out += [UInt8(n >> 8), UInt8(n & 0xFF)]
        } else {
            out.append(maskBit | 127)
            for shift in stride(from: 56, through: 0, by: -8) { out.append(UInt8((UInt64(n) >> UInt64(shift)) & 0xFF)) }
        }
        if let mask {
            out += mask
            out += payload.enumerated().map { $0.element ^ mask[$0.offset & 3] }
        } else {
            out += payload
        }
        return out
    }

    public static func text(_ s: String) -> [UInt8] { encode(.text, Array(s.utf8)) }

    public static func close(code: UInt16, reason: String) -> [UInt8] {
        encode(.close, [UInt8(code >> 8), UInt8(code & 0xFF)] + Array(reason.utf8.prefix(120)))
    }

    /// 101 response for an upgrade request.
    public static func handshakeResponse(clientKey: String) -> [UInt8] {
        let head = "HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            "Sec-WebSocket-Accept: \(acceptKey(for: clientKey))\r\n\r\n"
        return Array(head.utf8)
    }
}

/// Incremental frame parser. Feed bytes with `append`, pull frames with `next()`.
public struct WSFrameParser {
    public enum ParseError: Error, Equatable {
        case unmaskedClientFrame
        case reservedBits
        case badOpcode
        case controlFrameTooLong
        case fragmentedControlFrame
        case tooLarge
    }

    private var buffer: [UInt8] = []
    public var requireMask: Bool
    public var maxPayload: Int

    public init(requireMask: Bool = true, maxPayload: Int = 1 << 20) {
        self.requireMask = requireMask
        self.maxPayload = maxPayload
    }

    public mutating func append(_ bytes: [UInt8]) { buffer += bytes }

    public var bufferedCount: Int { buffer.count }

    public mutating func next() throws -> WebSocket.Frame? {
        guard buffer.count >= 2 else { return nil }
        let b0 = buffer[0], b1 = buffer[1]
        if b0 & 0x70 != 0 { throw ParseError.reservedBits }
        guard let opcode = WebSocket.Opcode(rawValue: b0 & 0x0F) else { throw ParseError.badOpcode }
        let fin = b0 & 0x80 != 0
        let masked = b1 & 0x80 != 0
        if requireMask && !masked { throw ParseError.unmaskedClientFrame }
        var len = Int(b1 & 0x7F)
        var offset = 2
        if len == 126 {
            guard buffer.count >= 4 else { return nil }
            len = Int(buffer[2]) << 8 | Int(buffer[3])
            offset = 4
        } else if len == 127 {
            guard buffer.count >= 10 else { return nil }
            var v: UInt64 = 0
            for i in 2..<10 { v = v << 8 | UInt64(buffer[i]) }
            guard v <= UInt64(maxPayload) else { throw ParseError.tooLarge }
            len = Int(v)
            offset = 10
        }
        if opcode.isControl {
            if len > 125 { throw ParseError.controlFrameTooLong }
            if !fin { throw ParseError.fragmentedControlFrame }
        }
        if len > maxPayload { throw ParseError.tooLarge }
        var mask: [UInt8] = []
        if masked {
            guard buffer.count >= offset + 4 else { return nil }
            mask = Array(buffer[offset..<offset + 4])
            offset += 4
        }
        guard buffer.count >= offset + len else { return nil }
        var payload = Array(buffer[offset..<offset + len])
        if masked {
            for i in 0..<payload.count { payload[i] ^= mask[i & 3] }
        }
        buffer.removeFirst(offset + len)
        return WebSocket.Frame(fin: fin, opcode: opcode, payload: payload)
    }
}

/// Reassembles fragmented data messages and surfaces control frames.
public struct WSMessageAssembler {
    public enum Event: Equatable {
        case text(String)
        case binary([UInt8])
        case ping([UInt8])
        case pong([UInt8])
        case close(code: UInt16?)
    }

    public enum AssemblyError: Error, Equatable {
        case unexpectedContinuation
        case interleavedData
        case invalidUTF8
        case tooLarge
    }

    private var partialOpcode: WebSocket.Opcode?
    private var partial: [UInt8] = []
    public var maxMessage: Int

    public init(maxMessage: Int = 1 << 20) { self.maxMessage = maxMessage }

    public mutating func consume(_ frame: WebSocket.Frame) throws -> Event? {
        switch frame.opcode {
        case .ping: return .ping(frame.payload)
        case .pong: return .pong(frame.payload)
        case .close:
            let code: UInt16? = frame.payload.count >= 2 ? UInt16(frame.payload[0]) << 8 | UInt16(frame.payload[1]) : nil
            return .close(code: code)
        case .text, .binary:
            if partialOpcode != nil { throw AssemblyError.interleavedData }
            if frame.fin { return try finish(frame.opcode, frame.payload) }
            partialOpcode = frame.opcode
            partial = frame.payload
            return nil
        case .continuation:
            guard let op = partialOpcode else { throw AssemblyError.unexpectedContinuation }
            partial += frame.payload
            if partial.count > maxMessage { throw AssemblyError.tooLarge }
            if !frame.fin { return nil }
            let data = partial
            partialOpcode = nil
            partial = []
            return try finish(op, data)
        }
    }

    private func finish(_ op: WebSocket.Opcode, _ data: [UInt8]) throws -> Event {
        if op == .text {
            guard let s = String(bytes: data, encoding: .utf8) else { throw AssemblyError.invalidUTF8 }
            return .text(s)
        }
        return .binary(data)
    }
}
