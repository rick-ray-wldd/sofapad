import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { sha256, hmacSha256, hex, utf8, tokenProof } from '../js/sha256.js';

test('sha256 matches node:crypto on many lengths', () => {
  for (let n = 0; n < 300; n += 7) {
    const b = randomBytes(n);
    assert.equal(hex(sha256(new Uint8Array(b))), createHash('sha256').update(b).digest('hex'), `len ${n}`);
  }
  assert.equal(hex(sha256(utf8('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('hmac matches node:crypto, including long keys', () => {
  for (const kl of [0, 5, 64, 65, 100]) {
    const key = randomBytes(kl);
    const msg = randomBytes(37);
    assert.equal(hex(hmacSha256(new Uint8Array(key), new Uint8Array(msg))), createHmac('sha256', key).update(msg).digest('hex'));
  }
});

test('token proof = HMAC(hex(SHA256(token)), nonce) — same vector as the Swift test', () => {
  const token = 'test-token-AbC_123';
  const nonce = 'bm9uY2Utbm9uY2Utbm9uY2U=';
  const key = createHash('sha256').update(token).digest('hex');
  const expected = createHmac('sha256', key).update(nonce).digest('hex');
  assert.equal(tokenProof(token, nonce), expected);
  console.log('cross-language vector:', expected);
});
