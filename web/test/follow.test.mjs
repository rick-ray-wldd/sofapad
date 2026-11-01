// SOFA-12: the versioned protocol on the phone's side, and the page following the Mac app's version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Link, PROTOCOL, protocolFit } from '../js/connection.js';
import { MAX_RELOADS, macBuild, pageBuild, readMark, decide, reloadURL, cleanURL } from '../js/follow.js';

class FakeWS {
  static last = null;
  constructor(url) { this.url = url; this.sent = []; this.readyState = 1; FakeWS.last = this; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this.onclose && this.onclose({ code: 1000 }); }
  recv(obj) { this.onmessage({ data: JSON.stringify(obj) }); }
}
const memStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: (k) => m.delete(k) };
};

test('the page speaks protocol 2 and works with Macs that speak 1 or 2', () => {
  assert.deepEqual(PROTOCOL, { speaks: 2, supports: [1, 2] });
  assert.equal(protocolFit({}), 'ok', 'a Mac that says no version speaks 1');
  assert.equal(protocolFit({ v: 1 }), 'ok', 'SofaPad 4.4 on the Mac');
  assert.equal(protocolFit({ v: 2, vmin: 1 }), 'ok');
  assert.equal(protocolFit({ v: 3, vmin: 2 }), 'ok', 'a newer Mac that still accepts this page\'s version');
  assert.equal(protocolFit({ v: 3, vmin: 3 }), 'page-old', 'a newer Mac that no longer accepts 2');
  assert.equal(protocolFit({ v: 4, vmin: 3 }), 'page-old');
  assert.equal(protocolFit({ v: 0, vmin: -1 }), 'mac-old');
});

test('auth and pair requests say which version the page speaks', () => {
  const link = new Link({ url: 'ws://x/ws', store: memStore({ token: 'TOK' }), WebSocketImpl: FakeWS });
  link.connect();
  FakeWS.last.recv({ t: 'hello', nonce: 'n', v: 2, vmin: 1 });
  assert.equal(FakeWS.last.sent[0].t, 'auth');
  assert.equal(FakeWS.last.sent[0].v, 2);
  link.requestPairing();
  assert.deepEqual(FakeWS.last.sent.at(-1), { t: 'pair_request', device: 'phone', v: 2 });
  link.stop();
});

test('a Mac this page cannot talk to: no login, a clear state, and a slow look again', async () => {
  const states = [];
  const link = new Link({ url: 'ws://x/ws', store: memStore({ token: 'TOK' }), WebSocketImpl: FakeWS,
    onState: (s, info) => states.push([s, info]), incompatibleRetryMs: 20 });
  link.connect();
  const first = FakeWS.last;
  first.recv({ t: 'hello', nonce: 'n', v: 3, vmin: 3 });
  assert.equal(first.sent.length, 0, 'no proof is sent to a Mac that would not understand it');
  assert.equal(first.readyState, 3, 'the connection is closed');
  assert.deepEqual(states.at(-1), ['incompatible', { page: 2, fit: 'page-old', mac: 3 }]);
  await new Promise((r) => setTimeout(r, 40));
  assert.notEqual(FakeWS.last, first, 'it looks again (the Mac may have been updated)');
  assert.equal(link.state, 'incompatible', 'no "connecting" flicker while it looks');
  FakeWS.last.recv({ t: 'hello', nonce: 'n2', v: 2, vmin: 1 });
  FakeWS.last.recv({ t: 'auth_ok', host: 'Neo' });
  assert.equal(link.state, 'ready');
  link.stop();
});

test('the Mac turns the page away (auth_fail "protocol", close 4426): incompatible, not "pair again"', () => {
  const states = [];
  const store = memStore({ token: 'TOK' });
  const link = new Link({ url: 'ws://x/ws', store, WebSocketImpl: FakeWS, onState: (s, info) => states.push([s, info]) });
  link.connect();
  FakeWS.last.recv({ t: 'hello', nonce: 'n', v: 2, vmin: 1 });
  FakeWS.last.recv({ t: 'auth_fail', reason: 'protocol', v: 1, vmin: 0 });
  assert.deepEqual(states.at(-1), ['incompatible', { page: 2, fit: 'mac-old', mac: 1 }]);
  assert.equal(store.get('token'), 'TOK', 'the pairing is kept');
  link.stop();
  const link2 = new Link({ url: 'ws://x/ws', store, WebSocketImpl: FakeWS, onState: (s, info) => states.push([s, info]) });
  link2.connect();
  FakeWS.last.onclose({ code: 4426 });
  assert.equal(link2.state, 'incompatible');
  link2.stop();
});

test('onHello can stop the link before it logs in (the page reloads instead)', () => {
  const link = new Link({ url: 'ws://x/ws', store: memStore({ token: 'TOK' }), WebSocketImpl: FakeWS, onHello: () => false });
  link.connect();
  FakeWS.last.recv({ t: 'hello', nonce: 'n', v: 2, ver: '4.5.1', build: 'b' });
  assert.equal(FakeWS.last.sent.length, 0);
  assert.deepEqual(link.mac, { ver: '4.5.1', build: 'b' });
  link.stop();
});

test('follow: same version stays, another version reloads, at most twice for one Mac version', () => {
  const page = pageBuild('4.5.0', '2026-11-01 10:00');
  assert.equal(page, '4.5.0+2026-11-01 10:00');
  assert.equal(macBuild({ ver: '4.5.0', build: '2026-11-01 10:00' }), page);
  assert.equal(macBuild({}), null, 'a Mac that does not say its version');
  assert.deepEqual(decide(page, page, null), { act: 'stay' });
  assert.deepEqual(decide(page, null, null), { act: 'stay' });
  const mac = '4.5.1+2026-11-02 09:00';
  assert.deepEqual(decide(page, mac, null), { act: 'reload', n: 1 });
  assert.deepEqual(decide(page, mac, { n: 1, target: mac }), { act: 'reload', n: 2 });
  assert.deepEqual(decide(page, mac, { n: MAX_RELOADS, target: mac }), { act: 'stuck', n: 2 });
  assert.deepEqual(decide(page, mac, { n: 2, target: '4.5.1+older' }), { act: 'reload', n: 1 }, 'a newer Mac starts again');
  assert.deepEqual(decide(page, '4.5.0+other build', null), { act: 'reload', n: 1 }, 'a rebuild of the same version');
});

test('follow: the mark rides in the address and comes off again, the #fragment stays', () => {
  const mac = '4.5.1+2026-11-02 09:00';
  const url = reloadURL('http://192.168.1.20:8765/#pair=123456', mac, 1);
  const u = new URL(url);
  assert.equal(u.hash, '#pair=123456');
  assert.deepEqual(readMark(u.search), { n: 1, target: mac });
  assert.equal(cleanURL(url), '/#pair=123456');
  assert.equal(cleanURL('http://h:1/?x=1&follow=2~a'), '/?x=1');
  assert.equal(readMark(''), null);
  assert.equal(readMark('?follow=junk'), null);
  // a full chain: the page that keeps coming back old stops after MAX_RELOADS
  let href = 'http://h:1/';
  let reloads = 0;
  for (let i = 0; i < 10; i++) {
    const d = decide('4.5.0+b', mac, readMark(new URL(href).search));
    if (d.act !== 'reload') { assert.equal(d.act, 'stuck'); break; }
    reloads++;
    href = reloadURL(href, mac, d.n);
  }
  assert.equal(reloads, MAX_RELOADS);
});
