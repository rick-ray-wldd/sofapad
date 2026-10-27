import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Link } from '../js/connection.js';
import { tokenProof } from '../js/sha256.js';

class FakeWS {
  static last = null;
  constructor(url) { this.url = url; this.sent = []; this.readyState = 1; FakeWS.last = this; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this.onclose && this.onclose({ code: 1000 }); }
  recv(obj) { this.onmessage({ data: JSON.stringify(obj) }); }
}
function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: (k) => m.delete(k), m };
}

test('no token: asks for pairing; code pairs and stores the token', () => {
  const store = memStore();
  const states = [];
  const link = new Link({ url: 'ws://x/ws', store, onState: (s) => states.push(s), WebSocketImpl: FakeWS });
  link.connect();
  const ws = FakeWS.last;
  ws.recv({ t: 'hello', nonce: 'n1', host: 'Neo' });
  assert.equal(link.state, 'need_pair');
  link.pair('123456');
  assert.deepEqual(ws.sent.at(-1), { t: 'auth', code: '123456', device: 'phone', sid: link.sid });
  ws.recv({ t: 'auth_ok', token: 'TOK', host: 'Neo', perm: true });
  assert.equal(store.get('token'), 'TOK');
  assert.equal(link.state, 'ready');
  link.stop();
});

test('stored token: logs in with a proof, never the token itself', () => {
  const store = memStore({ token: 'TOK' });
  const link = new Link({ url: 'ws://x/ws', store, WebSocketImpl: FakeWS });
  link.connect();
  const ws = FakeWS.last;
  ws.recv({ t: 'hello', nonce: 'nonce-1', host: 'Neo' });
  const auth = ws.sent[0];
  assert.equal(auth.proof, tokenProof('TOK', 'nonce-1'));
  assert.ok(!JSON.stringify(ws.sent).includes('TOK'));
  link.stop();
});

test('bad token is forgotten', () => {
  const store = memStore({ token: 'OLD' });
  const link = new Link({ url: 'ws://x/ws', store, WebSocketImpl: FakeWS });
  link.connect();
  FakeWS.last.recv({ t: 'hello', nonce: 'n' });
  FakeWS.last.recv({ t: 'auth_fail', reason: 'bad_token' });
  assert.equal(store.get('token'), null);
  assert.equal(link.state, 'need_pair');
  link.stop();
});

// PKM-4 (D-30): text never goes out again after a reconnect — another window may be in front on the Mac by then.
function readyLink(extra = {}) {
  const events = [];
  const link = new Link({ url: 'ws://x/ws', store: memStore({ token: 'TOK' }), WebSocketImpl: FakeWS, onEvent: (m) => events.push(m), ...extra });
  link.connect();
  FakeWS.last.recv({ t: 'hello', nonce: 'n', boot: 'B1' });
  FakeWS.last.recv({ t: 'auth_ok', host: 'Neo', last: 0, boot: 'B1' });
  return { link, events };
}

test('text typed while offline is not queued for later', () => {
  const events = [];
  const link = new Link({ url: 'ws://x/ws', store: memStore({ token: 'TOK' }), WebSocketImpl: FakeWS, onEvent: (m) => events.push(m) });
  link.connect();
  const ws = FakeWS.last;
  assert.equal(link.sendReliable({ t: 'text', s: '你好' }), null);
  assert.deepEqual(events.at(-1), { t: 'notsent', msg: { t: 'text', s: '你好' } });
  ws.recv({ t: 'hello', nonce: 'n' });
  ws.recv({ t: 'auth_ok', host: 'Neo', last: 0 });
  assert.equal(ws.sent.filter((m) => m.t === 'text').length, 0, 'nothing typed later');
  link.stop();
});

test('after a reconnect: what the Mac got is dropped quietly, the rest is reported, nothing is resent', () => {
  const { link, events } = readyLink();
  const ws1 = FakeWS.last;
  const a = link.sendReliable({ t: 'text', s: 'Orca 那段' });
  const b = link.sendReliable({ t: 'key', k: 'enter', mods: [] });
  const c = link.sendReliable({ t: 'text', s: '沒送到' });
  assert.equal(link.inFlight, 3);
  ws1.close();                                   // connection lost before any ack
  assert.equal(link.state, 'offline');
  link.connect();
  const ws2 = FakeWS.last;
  ws2.recv({ t: 'hello', nonce: 'n2', boot: 'B1' });
  ws2.recv({ t: 'auth_ok', host: 'Neo', last: b, boot: 'B1' }); // the Mac typed a and b
  assert.equal(ws2.sent.filter((m) => m.t === 'text' || m.t === 'key').length, 0, 'nothing sent again');
  const u = events.find((m) => m.t === 'undelivered');
  assert.deepEqual(u.items.map((m) => m.id), [c]);
  assert.equal(u.restarted, false);
  assert.equal(link.inFlight, 0);
  assert.ok(a < b && b < c);
  link.stop();
});

test('Mac app restarted while text was in flight: all of it is reported as unknown, none resent', () => {
  const { link, events } = readyLink();
  link.sendReliable({ t: 'text', s: 'x' });
  FakeWS.last.close();
  link.connect();
  FakeWS.last.recv({ t: 'hello', nonce: 'n2', boot: 'B2' });
  FakeWS.last.recv({ t: 'auth_ok', host: 'Neo', last: 0, boot: 'B2' });
  const u = events.find((m) => m.t === 'undelivered');
  assert.equal(u.items.length, 1);
  assert.equal(u.restarted, true);
  assert.equal(FakeWS.last.sent.filter((m) => m.t === 'text').length, 0);
  link.stop();
});

test('heartbeat: a connection that went quiet is dropped and the link reconnects', () => {
  const { link } = readyLink();
  let t = 0;
  link.now = () => t;
  link.lastHeard = 0;
  const first = FakeWS.last;
  t = 3000;
  link.heartbeat();
  assert.equal(link.state, 'ready', 'quiet for 3 s: still fine');
  assert.equal(first.sent.at(-1).t, 'ping');
  t = 4600;
  link.heartbeat();
  assert.equal(link.state, 'offline', 'quiet for 4.6 s: dead');
  assert.equal(first.readyState, 3);
  assert.ok(link.retryTimer, 'reconnect scheduled');
  link.stop();
});

test('reconnect backoff: fast on a LAN, never more than about 2 s', () => {
  const link = new Link({ url: 'ws://x/ws', store: memStore(), WebSocketImpl: FakeWS });
  const waits = [];
  for (let i = 0; i < 8; i++) { waits.push(link.backoff); link.scheduleReconnect(); }
  link.stop();
  assert.equal(waits[0], 300);
  assert.ok(waits.every((w) => w <= 2000));
  assert.equal(link.attempts, 8);
});

test('mouse moves are dropped while not ready', () => {
  const link = new Link({ url: 'ws://x/ws', store: memStore(), WebSocketImpl: FakeWS });
  link.connect();
  link.send({ t: 'move', dx: 1, dy: 1 });
  assert.equal(FakeWS.last.sent.length, 0);
  link.stop();
});

test('coming back to the page drops a silently dead socket and reconnects', () => {
  const store = memStore({ token: 'TOK' });
  const link = new Link({ url: 'ws://x/ws', store, WebSocketImpl: FakeWS });
  let t = 0;
  link.now = () => t;
  link.connect();
  const first = FakeWS.last;
  first.recv({ t: 'hello', nonce: 'n' });
  first.recv({ t: 'auth_ok', host: 'Neo' });
  t = 1000;
  link.reconnectNow();
  assert.equal(FakeWS.last, first, 'recently heard: keep the socket');
  t = 9000; // page was suspended; nothing heard for 8 s
  link.reconnectNow();
  assert.notEqual(FakeWS.last, first, 'dead socket replaced by a new one');
  assert.equal(link.state, 'connecting');
  link.stop();
});
