// The update feed (SOFA-12): writes appcast.xml for one release and checks the signatures in it.
//
//   node tools/appcast.mjs write --version 4.5.0 --build 20261101120000 --url https://…/SofaPad-4.5.0-macOS.zip
//        --zip dist/release/SofaPad-4.5.0-macOS.zip --signature <base64> --notes docs/release/4.5.0.md --out appcast.xml
//   node tools/appcast.mjs verify --feed appcast.xml --zip SofaPad-4.5.0-macOS.zip --key <SUPublicEDKey>
//
// The feed carries the release notes in English and Chinese (the two halves of docs/release/<version>.md, split at
// its "---" line); Sparkle shows the one that fits the Mac's language. The archive is signed with sign_update; the
// feed itself is signed after it is written (sign_update on the xml appends a signature block). `verify` checks
// both against the public key, the one in the app's Info.plist — the private key is never needed for that.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createPublicKey, verify as edVerify } from 'node:crypto';

export const REPO = 'https://github.com/rick-ray-wldd/sofapad';

/** The release notes for the app's update window: { en, zh } Markdown, without the title and the download section. */
export function notesForUpdater(markdown, blobBase) {
  const [en, zh = ''] = markdown.split(/^---\s*$/m);
  const tidy = (part) => {
    const out = [];
    let skipping = false;
    for (const line of part.split('\n')) {
      if (/^# /.test(line)) continue;   // the title: Sparkle shows the version itself
      if (/^## /.test(line)) skipping = /^## (Download and install|下載和安裝)\s*$/.test(line);   // already installed
      if (!skipping) out.push(line);
    }
    return out.join('\n').trim()
      .replace(/\]\(\.\.\/\.\.\//g, `](${blobBase}/`)
      .replace(/\]\(\.\.\//g, `](${blobBase}/docs/`);
  };
  return { en: tidy(en), zh: tidy(zh) };
}

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cdata = (s) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export function appcast({ version, build, url, length, signature, notes, minOS = '13.0', date = new Date() }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>SofaPad</title>
    <link>${REPO}</link>
    <description>SofaPad updates</description>
    <language>en</language>
    <item>
      <title>SofaPad ${xmlEscape(version)}</title>
      <pubDate>${date.toUTCString()}</pubDate>
      <sparkle:version>${xmlEscape(build)}</sparkle:version>
      <sparkle:shortVersionString>${xmlEscape(version)}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>${xmlEscape(minOS)}</sparkle:minimumSystemVersion>
      <link>${REPO}/releases/tag/v${xmlEscape(version)}</link>
      <description xml:lang="en" sparkle:format="markdown">${cdata(notes.en)}</description>
      <description xml:lang="zh-Hant" sparkle:format="markdown">${cdata(notes.zh)}</description>
      <enclosure url="${xmlEscape(url)}" length="${length}" type="application/octet-stream" sparkle:edSignature="${xmlEscape(signature)}"/>
    </item>
  </channel>
</rss>
`;
}

function edKey(base64) {
  const raw = Buffer.from(base64.trim(), 'base64');
  if (raw.length !== 32) throw new Error(`an EdDSA public key is 32 bytes, this one is ${raw.length}`);
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw.toString('base64url') }, format: 'jwk' });
}

/** The feed's own signature (sign_update on the xml): the block at the end covers every byte before it. */
export function feedSignature(feed) {
  const marker = Buffer.from('<!-- sparkle-signatures:\n');
  const at = feed.lastIndexOf(marker);
  if (at < 0) return null;
  const block = feed.subarray(at + marker.length).toString('utf8');
  const sig = /^edSignature:\s*(\S+)\s*$/m.exec(block);
  const len = /^length:\s*(\d+)\s*$/m.exec(block);
  return sig && len ? { content: feed.subarray(0, at), signature: sig[1], length: Number(len[1]) } : null;
}

export function verifyFeed({ feed, zip, key }) {
  const k = edKey(key);
  const problems = [];
  const signed = feedSignature(feed);
  if (!signed) problems.push('the feed is not signed');
  else {
    if (signed.length !== signed.content.length) problems.push('the feed signature covers another length');
    if (!edVerify(null, signed.content, k, Buffer.from(signed.signature, 'base64'))) problems.push('the feed signature does not match the key');
  }
  const text = feed.toString('utf8');
  const enc = /<enclosure\b[^>]*>/.exec(text)?.[0] || '';
  const sig = /sparkle:edSignature="([^"]+)"/.exec(enc)?.[1];
  const length = Number(/\blength="(\d+)"/.exec(enc)?.[1]);
  if (!sig) problems.push('the enclosure has no sparkle:edSignature');
  else if (!edVerify(null, zip, k, Buffer.from(sig, 'base64'))) problems.push('the archive signature does not match the key');
  if (length !== zip.length) problems.push(`the enclosure length (${length}) is not the archive's (${zip.length})`);
  for (const lang of ['en', 'zh-Hant']) {
    if (!text.includes(`<description xml:lang="${lang}" sparkle:format="markdown">`)) problems.push(`no ${lang} release notes`);
  }
  return problems;
}

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  return o;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = args(rest);
  if (cmd === 'write') {
    for (const k of ['version', 'build', 'url', 'zip', 'signature', 'notes', 'out']) {
      if (!o[k]) { console.error(`--${k} is needed`); process.exit(2); }
    }
    const notes = notesForUpdater(readFileSync(o.notes, 'utf8'), o.blob || `${REPO}/blob/v${o.version}`);
    if (!notes.en || !notes.zh) { console.error(`${o.notes}: an English and a Chinese half, split by a "---" line`); process.exit(1); }
    writeFileSync(o.out, appcast({ version: o.version, build: o.build, url: o.url, length: statSync(o.zip).size,
      signature: o.signature, notes, minOS: o['min-os'] || '13.0' }));
    console.log(`wrote ${o.out}`);
  } else if (cmd === 'verify') {
    const problems = verifyFeed({ feed: readFileSync(o.feed), zip: readFileSync(o.zip), key: o.key });
    if (problems.length) { for (const p of problems) console.error(`✗ ${p}`); process.exit(1); }
    console.log('✓ feed signed with the key, archive signed with the key, length right, notes in English and Chinese');
  } else {
    console.error('usage: node tools/appcast.mjs write|verify …');
    process.exit(2);
  }
}
