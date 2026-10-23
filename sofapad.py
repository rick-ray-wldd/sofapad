#!/usr/bin/env python3
"""SofaPad helper: turn an iPhone browser into a keyboard and trackpad for this Mac.

Run on the Mac:  python3 sofapad.py
Then open the printed URL on the iPhone (same Wi-Fi) and enter the PIN.

Standard library only. Mouse and keyboard events are posted through
CoreGraphics (Quartz Event Services) with ctypes, so the app that runs this
script (Terminal, iTerm...) needs Accessibility permission.

Use --dry-run to log events instead of posting them (works on any OS).
"""

import argparse
import asyncio
import base64
import ctypes
import ctypes.util
import hashlib
import json
import os
import secrets
import socket
import struct
import subprocess
import sys
import time

VERSION = "0.3.0"
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web")
CONFIG_PATH = os.path.expanduser("~/.sofapad.json")

# macOS virtual key codes (Carbon kVK_*)
KEYCODES = {
    "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9,
    "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19,
    "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28,
    "0": 29, "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "l": 37, "j": 38,
    "'": 39, "k": 40, ";": 41, "\\": 42, ",": 43, "/": 44, "n": 45, "m": 46, ".": 47,
    "`": 50,
    "return": 36, "tab": 48, "space": 49, "backspace": 51, "escape": 53,
    "forwarddelete": 117, "home": 115, "end": 119, "pageup": 116, "pagedown": 121,
    "left": 123, "right": 124, "down": 125, "up": 126,
    "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97, "f7": 98, "f8": 100,
    "f9": 101, "f10": 109, "f11": 103, "f12": 111,
}
MOD_FLAGS = {"shift": 1 << 17, "ctrl": 1 << 18, "alt": 1 << 19, "cmd": 1 << 20}
MOD_KEYCODES = {"cmd": 55, "shift": 56, "alt": 58, "ctrl": 59}
# Real arrow/navigation keys carry these flags; without them macOS ignores
# synthetic ctrl+arrow for Mission Control and switching Spaces.
FLAG_NUMPAD, FLAG_FN = 1 << 21, 1 << 23
NAV_FLAGS = {"left": FLAG_NUMPAD | FLAG_FN, "right": FLAG_NUMPAD | FLAG_FN,
             "up": FLAG_NUMPAD | FLAG_FN, "down": FLAG_NUMPAD | FLAG_FN,
             "home": FLAG_FN, "end": FLAG_FN, "pageup": FLAG_FN, "pagedown": FLAG_FN,
             "forwarddelete": FLAG_FN}
NAV_FLAGS.update({"f%d" % i: FLAG_FN for i in range(1, 13)})
# Apps the phone may open by name (allowlist). macOS 26 replaced Launchpad with "Apps".
APPS = {"launchpad": [["open", "-a", "Apps"], ["open", "-a", "Launchpad"]]}


def log(*args):
    print(time.strftime("%H:%M:%S"), *args, flush=True)


# ---------------------------------------------------------------------------
# Input injection
# ---------------------------------------------------------------------------

class CGPoint(ctypes.Structure):
    _fields_ = [("x", ctypes.c_double), ("y", ctypes.c_double)]


class CGSize(ctypes.Structure):
    _fields_ = [("width", ctypes.c_double), ("height", ctypes.c_double)]


class CGRect(ctypes.Structure):
    _fields_ = [("origin", CGPoint), ("size", CGSize)]


class MacInjector:
    # CGEventType
    MOVED, LDOWN, LUP, RDOWN, RUP, LDRAG = 5, 1, 2, 3, 4, 6
    HID_TAP = 0
    CLICK_STATE_FIELD = 1  # kCGMouseEventClickState
    BUTTON_LEFT, BUTTON_RIGHT = 0, 1

    def __init__(self):
        path = ctypes.util.find_library("CoreGraphics") or \
            "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"
        cg = ctypes.CDLL(path)
        cf = ctypes.CDLL(ctypes.util.find_library("CoreFoundation") or
                         "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
        vp, u32, i32 = ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int32

        cg.CGEventCreate.restype = vp
        cg.CGEventCreate.argtypes = [vp]
        cg.CGEventGetLocation.restype = CGPoint
        cg.CGEventGetLocation.argtypes = [vp]
        cg.CGEventCreateMouseEvent.restype = vp
        cg.CGEventCreateMouseEvent.argtypes = [vp, u32, CGPoint, u32]
        cg.CGEventCreateKeyboardEvent.restype = vp
        cg.CGEventCreateKeyboardEvent.argtypes = [vp, ctypes.c_uint16, ctypes.c_bool]
        cg.CGEventKeyboardSetUnicodeString.restype = None
        cg.CGEventKeyboardSetUnicodeString.argtypes = [vp, ctypes.c_ulong, ctypes.POINTER(ctypes.c_uint16)]
        # Non-variadic variant: ctypes cannot call the variadic one correctly on arm64.
        cg.CGEventCreateScrollWheelEvent2.restype = vp
        cg.CGEventCreateScrollWheelEvent2.argtypes = [vp, u32, u32, i32, i32, i32]
        cg.CGEventSetFlags.restype = None
        cg.CGEventSetFlags.argtypes = [vp, ctypes.c_uint64]
        cg.CGEventSetIntegerValueField.restype = None
        cg.CGEventSetIntegerValueField.argtypes = [vp, u32, ctypes.c_int64]
        cg.CGEventPost.restype = None
        cg.CGEventPost.argtypes = [u32, vp]
        cg.CGGetActiveDisplayList.restype = i32
        cg.CGGetActiveDisplayList.argtypes = [u32, ctypes.POINTER(u32), ctypes.POINTER(u32)]
        cg.CGDisplayBounds.restype = CGRect
        cg.CGDisplayBounds.argtypes = [u32]
        cf.CFRelease.restype = None
        cf.CFRelease.argtypes = [vp]
        # macOS 10.15+: may this process post synthetic events? (needs Accessibility)
        for name in ("CGPreflightPostEventAccess", "CGRequestPostEventAccess"):
            if hasattr(cg, name):
                getattr(cg, name).restype = ctypes.c_bool
                getattr(cg, name).argtypes = []
        self.cg, self.cf = cg, cf

        self.left_down = False
        self.last_click = (0.0, 0.0, 0.0, 0)  # time, x, y, count
        self.mods = 0
        self._displays = []
        self._displays_at = 0.0

    # -- helpers -----------------------------------------------------------
    def _post(self, ev):
        if ev:
            self.cg.CGEventPost(self.HID_TAP, ev)
            self.cf.CFRelease(ev)

    def _location(self):
        ev = self.cg.CGEventCreate(None)
        p = self.cg.CGEventGetLocation(ev)
        self.cf.CFRelease(ev)
        return p.x, p.y

    def _display_rects(self):
        # Refresh every 2 s so a Mac Virtual Display that connects later is picked up.
        now = time.time()
        if now - self._displays_at > 2:
            ids = (ctypes.c_uint32 * 16)()
            n = ctypes.c_uint32(0)
            self.cg.CGGetActiveDisplayList(16, ids, ctypes.byref(n))
            rects = []
            for i in range(n.value):
                r = self.cg.CGDisplayBounds(ids[i])
                rects.append((r.origin.x, r.origin.y, r.size.width, r.size.height))
            self._displays = rects
            self._displays_at = now
        return self._displays

    def _clamp(self, x, y):
        rects = self._display_rects()
        if not rects:
            return x, y
        for (rx, ry, rw, rh) in rects:
            if rx <= x < rx + rw and ry <= y < ry + rh:
                return x, y
        # Outside every display: pull back into the nearest one.
        best = None
        for (rx, ry, rw, rh) in rects:
            cx = min(max(x, rx), rx + rw - 1)
            cy = min(max(y, ry), ry + rh - 1)
            d = (cx - x) ** 2 + (cy - y) ** 2
            if best is None or d < best[0]:
                best = (d, cx, cy)
        return best[1], best[2]

    def _mouse(self, etype, x, y, button, click_state=None):
        ev = self.cg.CGEventCreateMouseEvent(None, etype, CGPoint(x, y), button)
        if click_state:
            self.cg.CGEventSetIntegerValueField(ev, self.CLICK_STATE_FIELD, click_state)
        if self.mods:
            self.cg.CGEventSetFlags(ev, self.mods)
        self._post(ev)

    # -- public API ------------------------------------------------------------
    def move(self, dx, dy):
        x, y = self._location()
        x, y = self._clamp(x + dx, y + dy)
        if self.left_down:
            self._mouse(self.LDRAG, x, y, self.BUTTON_LEFT)
        else:
            self._mouse(self.MOVED, x, y, self.BUTTON_LEFT)

    def set_mods(self, mods):
        flags = 0
        for m in mods:
            flags |= MOD_FLAGS.get(m, 0)
        self.mods = flags

    def click(self, button):
        x, y = self._location()
        if button == "right":
            self._mouse(self.RDOWN, x, y, self.BUTTON_RIGHT, 1)
            self._mouse(self.RUP, x, y, self.BUTTON_RIGHT, 1)
            return
        t, lx, ly, count = self.last_click
        now = time.time()
        if now - t < 0.4 and abs(x - lx) < 6 and abs(y - ly) < 6:
            count = min(count + 1, 3)
        else:
            count = 1
        self.last_click = (now, x, y, count)
        self._mouse(self.LDOWN, x, y, self.BUTTON_LEFT, count)
        self._mouse(self.LUP, x, y, self.BUTTON_LEFT, count)

    def button(self, down):
        x, y = self._location()
        if down and not self.left_down:
            self.left_down = True
            self._mouse(self.LDOWN, x, y, self.BUTTON_LEFT, 1)
        elif not down and self.left_down:
            self.left_down = False
            self._mouse(self.LUP, x, y, self.BUTTON_LEFT, 1)

    def scroll(self, dx, dy):
        # units 0 = pixels; wheel1 vertical, wheel2 horizontal
        ev = self.cg.CGEventCreateScrollWheelEvent2(None, 0, 2, int(dy), int(dx), 0)
        self._post(ev)

    def key(self, name, mods):
        code = KEYCODES.get(name)
        if code is None:
            raise ValueError("unknown key %r" % name)
        flags = NAV_FLAGS.get(name, 0)
        for m in mods:
            flags |= MOD_FLAGS.get(m, 0)
        for down in (True, False):
            ev = self.cg.CGEventCreateKeyboardEvent(None, code, down)
            self.cg.CGEventSetFlags(ev, flags)
            self._post(ev)

    def text(self, s):
        # Up to 20 UTF-16 units per event is what macOS reliably delivers.
        units = s.encode("utf-16-le")
        codes = list(struct.unpack("<%dH" % (len(units) // 2), units))
        i = 0
        while i < len(codes):
            j = min(i + 20, len(codes))
            if j < len(codes) and 0xD800 <= codes[j - 1] <= 0xDBFF:
                j -= 1  # don't split a surrogate pair
            chunk = codes[i:j]
            buf = (ctypes.c_uint16 * len(chunk))(*chunk)
            for down in (True, False):
                ev = self.cg.CGEventCreateKeyboardEvent(None, 0, down)
                self.cg.CGEventSetFlags(ev, 0)
                self.cg.CGEventKeyboardSetUnicodeString(ev, len(chunk), buf)
                self._post(ev)
            i = j

    def release_all(self):
        if self.left_down:
            self.button(False)

    def can_post(self, request=False):
        """True/False from CGPreflightPostEventAccess; request=True also asks macOS to
        show its permission prompt and list the app in Accessibility settings."""
        cg = self.cg
        if not hasattr(cg, "CGPreflightPostEventAccess"):
            return None
        ok = bool(cg.CGPreflightPostEventAccess())
        if not ok and request and hasattr(cg, "CGRequestPostEventAccess"):
            ok = bool(cg.CGRequestPostEventAccess())
        return ok

    def self_test(self):
        """Nudge the pointer 1 pt and back; returns True if macOS actually moved it."""
        x0, y0 = self._location()
        tx, ty = self._clamp(x0 + 1, y0)
        if (tx, ty) == (x0, y0):
            tx, ty = self._clamp(x0 - 1, y0)
        self._mouse(self.MOVED, tx, ty, self.BUTTON_LEFT)
        time.sleep(0.05)
        x1, y1 = self._location()
        self._mouse(self.MOVED, x0, y0, self.BUTTON_LEFT)
        return (round(x1), round(y1)) != (round(x0), round(y0))


class DryRunInjector:
    """Logs what would be posted. Used for testing on non-Mac machines."""

    def __init__(self):
        self.events = []

    def _rec(self, *ev):
        self.events.append(ev)
        log("[dry-run]", *ev)

    def move(self, dx, dy):
        self._rec("move", round(dx, 2), round(dy, 2))

    def set_mods(self, mods):
        if mods:
            self._rec("mods", "+".join(mods))

    def click(self, button):
        self._rec("click", button)

    def button(self, down):
        self._rec("button", "down" if down else "up")

    def scroll(self, dx, dy):
        self._rec("scroll", int(dx), int(dy))

    def key(self, name, mods):
        if name not in KEYCODES:
            raise ValueError("unknown key %r" % name)
        self._rec("key", "+".join(list(mods) + [name]))

    def text(self, s):
        self._rec("text", s)

    def release_all(self):
        self._rec("release_all")

    # SOFAPAD_DRY_BLOCKED=1 simulates macOS refusing events (for testing the warning).
    def can_post(self, request=False):
        return os.environ.get("SOFAPAD_DRY_BLOCKED") != "1"

    def self_test(self):
        return os.environ.get("SOFAPAD_DRY_BLOCKED") != "1"


# ---------------------------------------------------------------------------
# Config / pairing
# ---------------------------------------------------------------------------

def load_config(reset_pin=False):
    cfg = {}
    try:
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
    except (OSError, ValueError):
        pass
    if reset_pin or not cfg.get("pin"):
        cfg["pin"] = "%06d" % secrets.randbelow(1000000)
        try:
            with open(CONFIG_PATH, "w") as f:
                json.dump(cfg, f)
            os.chmod(CONFIG_PATH, 0o600)
        except OSError as e:
            log("could not save config:", e)
    return cfg


class Lockout:
    def __init__(self, limit=8, window=60):
        self.limit, self.window = limit, window
        self.fails = {}

    def blocked(self, ip):
        n, t = self.fails.get(ip, (0, 0))
        if n >= self.limit and time.time() - t < self.window:
            return True
        if time.time() - t >= self.window:
            self.fails.pop(ip, None)
        return False

    def fail(self, ip):
        n, _ = self.fails.get(ip, (0, 0))
        self.fails[ip] = (n + 1, time.time())

    def ok(self, ip):
        self.fails.pop(ip, None)


# ---------------------------------------------------------------------------
# HTTP + WebSocket server (asyncio, hand-rolled)
# ---------------------------------------------------------------------------

CONTENT_TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript",
                 ".css": "text/css", ".json": "application/manifest+json",
                 ".png": "image/png", ".svg": "image/svg+xml"}


async def read_frame(reader):
    head = await reader.readexactly(2)
    b1, b2 = head[0], head[1]
    opcode = b1 & 0x0F
    masked = b2 & 0x80
    length = b2 & 0x7F
    if length == 126:
        length = struct.unpack(">H", await reader.readexactly(2))[0]
    elif length == 127:
        length = struct.unpack(">Q", await reader.readexactly(8))[0]
    if length > 1 << 20:
        raise ValueError("frame too large")
    mask = await reader.readexactly(4) if masked else b"\0\0\0\0"
    data = bytearray(await reader.readexactly(length))
    if masked:
        for i in range(length):
            data[i] ^= mask[i & 3]
    return opcode, bytes(data), bool(b1 & 0x80)


def encode_frame(payload, opcode=1):
    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    n = len(payload)
    if n < 126:
        header = struct.pack(">BB", 0x80 | opcode, n)
    elif n < 1 << 16:
        header = struct.pack(">BBH", 0x80 | opcode, 126, n)
    else:
        header = struct.pack(">BBQ", 0x80 | opcode, 127, n)
    return header + payload


class Server:
    def __init__(self, injector, pin, status):
        self.inj = injector
        self.pin = pin
        self.status = status      # {"post": bool|None, "selftest": bool|None}
        self.lockout = Lockout()
        self.clients = 0
        self.counts = {}
        self.last_report = time.time()

    def count(self, t):
        self.counts[t] = self.counts.get(t, 0) + 1
        now = time.time()
        if now - self.last_report >= 3:
            log("received:", ", ".join("%s %d" % kv for kv in sorted(self.counts.items())))
            self.counts = {}
            self.last_report = now

    async def handle(self, reader, writer):
        peer = writer.get_extra_info("peername") or ("?", 0)
        ip = peer[0]
        try:
            request = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 10)
        except (asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError, ConnectionError):
            writer.close()
            return
        lines = request.decode("latin-1").split("\r\n")
        try:
            method, path, _ = lines[0].split(" ", 2)
        except ValueError:
            writer.close()
            return
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        path = path.split("?", 1)[0]
        if path == "/ws" and headers.get("upgrade", "").lower() == "websocket":
            await self.websocket(reader, writer, headers, ip)
        else:
            await self.static(writer, method, path)

    async def static(self, writer, method, path):
        if path == "/":
            path = "/index.html"
        rel = os.path.normpath(path.lstrip("/"))
        full = os.path.join(WEB_DIR, rel)
        if rel.startswith("..") or not os.path.isfile(full) or method not in ("GET", "HEAD"):
            body = b"not found"
            writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % len(body) + body)
        else:
            with open(full, "rb") as f:
                body = f.read()
            ctype = CONTENT_TYPES.get(os.path.splitext(full)[1], "application/octet-stream")
            head = ("HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %d\r\n"
                    "Cache-Control: no-cache\r\nConnection: close\r\n\r\n" % (ctype, len(body))).encode()
            writer.write(head + (body if method == "GET" else b""))
        try:
            await writer.drain()
        except ConnectionError:
            pass
        writer.close()

    async def websocket(self, reader, writer, headers, ip):
        key = headers.get("sec-websocket-key", "")
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                      "Connection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n" % accept).encode())
        await writer.drain()
        sock = writer.get_extra_info("socket")
        if sock is not None:
            try:
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            except OSError:
                pass

        def send(obj):
            writer.write(encode_frame(json.dumps(obj, ensure_ascii=False)))

        authed = False
        self.clients += 1
        log("phone connected from", ip)
        try:
            while True:
                opcode, data, _ = await asyncio.wait_for(read_frame(reader), 30)
                if opcode == 8:
                    break
                if opcode == 9:
                    writer.write(encode_frame(data, 10))
                    continue
                if opcode != 1:
                    continue
                try:
                    msg = json.loads(data.decode("utf-8"))
                except ValueError:
                    continue
                t = msg.get("t")
                if t == "ping":
                    send({"t": "pong", "id": msg.get("id")})
                elif not authed:
                    if t != "auth":
                        send({"t": "need_auth"})
                    elif self.lockout.blocked(ip):
                        send({"t": "auth_fail", "reason": "locked"})
                    elif secrets.compare_digest(str(msg.get("pin", "")), self.pin):
                        authed = True
                        self.lockout.ok(ip)
                        send({"t": "auth_ok", "host": socket.gethostname(), "version": VERSION,
                              "post": self.status.get("post"), "selftest": self.status.get("selftest")})
                        log("paired:", ip)
                    else:
                        self.lockout.fail(ip)
                        send({"t": "auth_fail", "reason": "pin"})
                        log("wrong PIN from", ip)
                else:
                    self.count(t)
                    try:
                        reply = self.dispatch(msg)
                        if reply:
                            send(reply)
                    except Exception as e:  # keep the connection alive on bad input
                        log("error handling", t, e)
                        send({"t": "error", "msg": str(e)})
                await writer.drain()
        except (asyncio.TimeoutError, asyncio.IncompleteReadError, ConnectionError, ValueError):
            pass
        finally:
            self.clients -= 1
            self.inj.release_all()
            log("phone disconnected:", ip)
            writer.close()

    def dispatch(self, msg):
        t = msg.get("t")
        inj = self.inj
        if t == "m":
            inj.move(float(msg.get("dx", 0)), float(msg.get("dy", 0)))
        elif t == "c":
            inj.set_mods([m for m in msg.get("mods", []) if m in MOD_FLAGS])
            try:
                inj.click("right" if msg.get("b") == "r" else "left")
            finally:
                inj.set_mods([])
        elif t == "b":
            inj.button(bool(msg.get("down")))
        elif t == "s":
            inj.scroll(float(msg.get("dx", 0)), float(msg.get("dy", 0)))
        elif t == "k":
            mods = [m for m in msg.get("mods", []) if m in MOD_FLAGS]
            inj.key(str(msg.get("k", "")), mods)
        elif t == "txt":
            s = str(msg.get("s", ""))
            if s:
                inj.text(s[:2000])
        elif t == "app":
            name = str(msg.get("name", ""))
            if name not in APPS:
                raise ValueError("unknown app %r" % name)
            if isinstance(self.inj, DryRunInjector):
                self.inj._rec("app", name)
            else:
                for cmd in APPS[name]:
                    if subprocess.call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
                        break
        elif t == "selftest":
            ok = self.inj.self_test()
            self.status["selftest"] = ok
            log("self-test (pointer nudge):", "OK" if ok else "FAILED - macOS dropped the event")
            return {"t": "selftest", "ok": ok}
        elif t == "bs":
            for _ in range(max(0, min(int(msg.get("n", 1)), 200))):
                inj.key("backspace", [])


def lan_addresses():
    addrs = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        addrs.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    return addrs


def local_hostname():
    if sys.platform == "darwin":
        try:
            name = subprocess.check_output(["scutil", "--get", "LocalHostName"], text=True).strip()
            if name:
                return name + ".local"
        except (OSError, subprocess.CalledProcessError):
            pass
    return socket.gethostname()


def check_accessibility():
    """Returns True/False on macOS, None elsewhere."""
    if sys.platform != "darwin":
        return None
    try:
        lib = ctypes.CDLL("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
        lib.AXIsProcessTrusted.restype = ctypes.c_bool
        return bool(lib.AXIsProcessTrusted())
    except OSError:
        return None


def main():
    ap = argparse.ArgumentParser(description="SofaPad helper")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--dry-run", action="store_true", help="log events instead of posting them")
    ap.add_argument("--new-pin", action="store_true", help="generate a new pairing PIN")
    ap.add_argument("--pin", help="use this PIN for this run (testing)")
    ap.add_argument("--app", action="store_true", help="started from SofaPad.app (prints status lines for its menu)")
    args = ap.parse_args()

    cfg = load_config(reset_pin=args.new_pin)
    pin = args.pin or cfg["pin"]

    if args.dry_run or sys.platform != "darwin":
        if not args.dry_run:
            log("not macOS: falling back to --dry-run")
        injector = DryRunInjector()
    else:
        injector = MacInjector()
        trusted = check_accessibility()
        if trusted is False:
            log("!! Accessibility permission missing. Open System Settings > Privacy & Security >")
            log("!! Accessibility and enable %s, then restart it." % ("SofaPad" if args.app else "the app running this script (e.g. Terminal)"))

    status = {"post": None, "selftest": None}
    if True:
        status["post"] = injector.can_post(request=True)
        try:
            status["selftest"] = injector.self_test()
        except Exception as e:  # report, keep serving
            log("self-test error:", e)
        log("post-event access:", status["post"], "| pointer self-test:", status["selftest"])
        if status["post"] is False or status["selftest"] is False:
            print()
            if args.app:
                print("  !! macOS 沒有允許 SofaPad 控制滑鼠和鍵盤。請到「系統設定 > 隱私權與安全性 >")
                print("  !! 輔助使用」打開 SofaPad，然後結束 SofaPad 再重新打開。")
            else:
                print("  !! macOS 沒有允許這個程式控制滑鼠和鍵盤，手機送來的動作都會被丟掉。")
                print("  !! 請到「系統設定 > 隱私權與安全性 > 輔助使用」，打開「終端機」")
                print("  !!（如果沒有這一列，按 + 加入 /System/Applications/Utilities/Terminal.app），")
                print("  !! 然後在這個視窗按 Ctrl+C，再重新啟動 start.command。")
            print()
            if sys.platform == "darwin":
                subprocess.call(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"])
    server = Server(injector, pin, status)

    async def run():
        try:
            srv = await asyncio.start_server(server.handle, args.host, args.port)
        except OSError as e:
            log("!! cannot listen on port %d: %s" % (args.port, e))
            log("!! another app is probably using it; quit that app or use --port")
            if args.app:
                print("@@error Port %d is in use by another app / 連接埠被其他 App 佔用" % args.port, flush=True)
            sys.exit(2)
        print()
        print("  SofaPad %s is running." % VERSION)
        print("  On your iPhone (same Wi-Fi), open:")
        print("      http://%s:%d" % (local_hostname(), args.port))
        for a in lan_addresses():
            print("      http://%s:%d" % (a, args.port))
        print("  PIN: %s" % pin)
        print("  Ctrl+C to stop.\n", flush=True)
        if args.app:
            # SofaPad.app reads these lines from stdout to fill its menu bar menu.
            blocked = status["post"] is False or status["selftest"] is False
            print("@@url http://%s:%d" % (local_hostname(), args.port))
            print("@@pin %s" % pin)
            print("@@access %s" % ("blocked" if blocked else "ok"), flush=True)
        async with srv:
            await srv.serve_forever()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
