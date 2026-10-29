// WebSocket link to the Mac: login, heartbeat, reconnect with backoff, acked text/keys, fire-and-forget mouse
// messages. Nothing is ever sent again after a reconnect (PKM-4, D-30): by then another window may be in front
// on the Mac (Ray's 舊文字跑到下一個視窗). The Mac says which text it did get; the rest is reported, not resent.
import { tokenProof } from './sha256.js';

function randomId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b); // available on plain http, unlike crypto.randomUUID / crypto.subtle
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export class Link {
  /**
   * @param {object} o
   * @param {string} o.url        ws://host:port/ws
   * @param {object} o.store      {get(k), set(k,v), del(k)}
   * @param {function} o.onState  (state, info) state: connecting | need_pair | ready | offline
   * @param {function} o.onEvent  (msg) server messages other than handshake (status, ack, pairing, auth_fail…)
   * @param {function} [o.WebSocketImpl]
   */
  constructor({ url, store, onState, onEvent, WebSocketImpl, deviceName, pingMs = 1500, deadMs = 4500 }) {
    this.url = url;
    this.store = store;
    this.onState = onState || (() => {});
    this.onEvent = onEvent || (() => {});
    this.WS = WebSocketImpl || WebSocket;
    this.deviceName = deviceName || 'phone';
    this.sid = randomId();
    this.nextId = 1;
    this.pending = []; // text/keys sent and not acked yet, in order
    this.ws = null;
    this.state = 'offline';
    this.backoff = 300;
    this.attempts = 0;   // reconnect attempts since the link was last ready
    this.pingMs = pingMs;
    this.deadMs = deadMs; // nothing heard for this long while connected = the connection is dead (half-open TCP)
    this.boot = null;     // the Mac app's start id: changes when it restarts
    this.mac = null;      // {ver, build} of the Mac app
    this.rtt = null;
    this.pendingCode = null;
    this.stopped = false;
    this.pingTimer = null;
    this.retryTimer = null;
    this.lastHeard = 0;
    this.now = () => performance.now();
  }

  get token() {
    return this.store.get('token');
  }

  setState(s, info) {
    this.state = s;
    this.onState(s, info || {});
  }

  connect() {
    this.stopped = false;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    clearTimeout(this.retryTimer);
    this.setState('connecting', { attempt: this.attempts });
    let ws;
    try {
      ws = new this.WS(this.url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onmessage = (ev) => this.onMessage(ev.data);
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      clearInterval(this.pingTimer);
      if (ev && ev.code === 4409) {
        this.setState('offline', { reason: 'replaced' });
        return; // another phone took over; don't fight it
      }
      this.setState('offline', { reason: ev && ev.code });
      this.scheduleReconnect();
    };
    ws.onerror = () => {};
  }

  scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    this.attempts++;
    // LAN only: retry fast (0.3 s, ×1.6, at most 2 s) with a little jitter
    this.retryTimer = setTimeout(() => this.connect(), this.backoff * (0.85 + Math.random() * 0.3));
    this.backoff = Math.min(this.backoff * 1.6, 2000);
  }

  /** Drop a connection that went quiet (half-open after Wi-Fi sleep, Mac asleep): reconnect instead of waiting. */
  dropDead(reason) {
    const dead = this.ws;
    this.ws = null;
    clearInterval(this.pingTimer);
    try { if (dead) dead.close(); } catch { /* already gone */ }
    this.setState('offline', { reason });
    this.scheduleReconnect();
  }

  heartbeat() {
    if (this.state === 'ready' && this.now() - this.lastHeard > this.deadMs) { this.dropDead('timeout'); return; }
    this.raw({ t: 'ping', ts: performance.now(), wall: Date.now() });
  }

  /**
   * Reconnect right away (page became visible again, user tapped the status dot).
   * After iOS suspends a page the old socket can still say OPEN while being dead; if nothing was heard
   * for 5 s, drop it instead of waiting for a close event that may take very long.
   */
  reconnectNow() {
    this.backoff = 300;
    if (this.ws && this.ws.readyState === 1 && this.state === 'ready' && this.now() - this.lastHeard > this.deadMs) {
      const dead = this.ws;
      this.ws = null;
      clearInterval(this.pingTimer);
      try { dead.close(); } catch { /* already gone */ }
    }
    if (!this.ws) this.connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    if (this.ws) this.ws.close();
  }

  raw(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  /** Mouse etc.: dropped while offline (replaying old moves would be wrong). Clicks carry the send time: the Mac
   *  skips one that was held up in a stalled connection (D-30). */
  send(obj) {
    if (this.state !== 'ready') return;
    this.raw(obj.t === 'click' || obj.t === 'down' || obj.t === 'caret' ? { ...obj, sent: Date.now() } : obj);
  }

  /**
   * Text and keys: numbered and acked. Only while connected — text is never kept for later: by the time the link
   * is back, another window may be in front on the Mac. Returns the id, or null when it was not sent.
   */
  sendReliable(obj) {
    if (this.state !== 'ready' || !this.ws || this.ws.readyState !== 1) {
      this.onEvent({ t: 'notsent', msg: obj });
      return null;
    }
    const msg = { ...obj, id: this.nextId++ };
    this.pending.push({ msg, sentAt: performance.now() });
    this.raw({ ...msg, sent: Date.now() });
    return msg.id;
  }

  /** Text/keys sent and not acked yet. */
  get inFlight() { return this.pending.length; }

  /** How long the oldest of them has waited for its ack, in ms (0 when none). */
  get oldestPendingMs() { return this.pending.length ? performance.now() - this.pending[0].sentAt : 0; }

  pair(code) {
    this.pendingCode = code;
    if (this.state === 'need_pair' && this.ws) this.raw({ t: 'auth', code, device: this.deviceName, sid: this.sid });
    else this.connect();
  }

  requestPairing() {
    this.raw({ t: 'pair_request', device: this.deviceName });
  }

  forget() {
    this.store.del('token');
  }

  onMessage(data) {
    this.lastHeard = this.now();
    let m;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    switch (m.t) {
      case 'hello': {
        this.host = m.host;
        if (m.ver) this.mac = { ver: m.ver, build: m.build || '' };
        const token = this.token;
        if (this.pendingCode) {
          this.raw({ t: 'auth', code: this.pendingCode, device: this.deviceName, sid: this.sid });
        } else if (token) {
          this.raw({ t: 'auth', proof: tokenProof(token, m.nonce), device: this.deviceName, sid: this.sid });
        } else {
          this.setState('need_pair', { host: m.host });
        }
        return;
      }
      case 'auth_ok': {
        if (m.token) this.store.set('token', m.token);
        this.pendingCode = null;
        this.backoff = 300;
        const reconnected = this.attempts > 0;
        this.attempts = 0;
        // Text/keys still waiting for an ack from the last connection: `last` is the last one the Mac handled
        // (it answers only after finishing what it had queued). Those got typed; the rest did not, and are reported
        // instead of sent again (D-30). A Mac app older than PKM-4 sends no `last`: nothing is known, nothing resent.
        const restarted = this.boot != null && m.boot !== this.boot;
        this.boot = m.boot || null;
        const last = typeof m.last === 'number' && !restarted ? m.last : -1;
        const skipped = new Set(restarted ? [] : m.skipped || []);   // arrived too late, not typed
        const lost = this.pending.filter((p) => p.msg.id > last || skipped.has(p.msg.id)).map((p) => p.msg);
        this.pending = [];
        this.setState('ready', { ...m, reconnected });
        if (lost.length) this.onEvent({ t: 'undelivered', items: lost, restarted });
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.heartbeat(), this.pingMs);
        this.raw({ t: 'ping', ts: performance.now(), wall: Date.now() });
        return;
      }
      case 'auth_fail': {
        if (m.reason === 'bad_token') this.forget();
        this.pendingCode = null;
        this.setState('need_pair', m);
        this.onEvent(m);
        return;
      }
      case 'ack': {
        const i = this.pending.findIndex((p) => p.msg.id === m.id);
        if (i >= 0) {
          const [p] = this.pending.splice(i, 1);
          m.latency = performance.now() - p.sentAt;
          if (m.ok === false && m.err === 'late') { this.onEvent({ t: 'undelivered', items: [p.msg], late: m.late }); }
        }
        this.onEvent(m);
        if (this.pending.length === 0) this.onEvent({ t: 'drained' });
        return;
      }
      case 'pong': {
        const rtt = performance.now() - m.ts;
        this.rtt = this.rtt == null ? rtt : this.rtt * 0.7 + rtt * 0.3;
        this.onEvent({ t: 'rtt', rtt: this.rtt, last: rtt });
        return;
      }
      default:
        this.onEvent(m);
    }
  }
}
