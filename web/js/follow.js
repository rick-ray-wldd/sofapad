// The phone page follows the Mac app (SOFA-12). The Mac serves this page, so after SofaPad on the Mac is updated an
// open page (a Safari tab, or the Home Screen app coming back) is still the old one. The Mac's hello says which
// version it is; when that differs from this page, the page reloads itself to get the Mac's.
// Never in a loop: a reload marks the address (?follow=n~version). After two reloads for the same Mac version that
// still left this page different (a cache that keeps serving the old files), it stops and says so.

export const MAX_RELOADS = 2;

/** "4.5.1+2026-11-01 12:00": the version and build that identify what the Mac serves; null when the Mac doesn't say. */
export function macBuild(hello) {
  return hello && typeof hello.ver === 'string' && hello.ver ? `${hello.ver}+${hello.build || ''}` : null;
}

export function pageBuild(ver, build) {
  return `${ver}+${build || ''}`;
}

/** The mark a reload left in the address: { n, target }, or null. */
export function readMark(search) {
  let raw = null;
  try { raw = new URLSearchParams(search).get('follow'); } catch { return null; }
  const m = raw && /^(\d+)~(.+)$/.exec(raw);
  return m ? { n: Number(m[1]), target: m[2] } : null;
}

/**
 * What to do on a hello: 'stay' (same version, or the Mac didn't say), 'reload' (the n-th reload for this Mac
 * version), or 'stuck' (reloading did not bring the Mac's page: stop and tell the user).
 */
export function decide(page, mac, mark) {
  if (!mac || mac === page) return { act: 'stay' };
  const n = mark && mark.target === mac ? mark.n : 0;
  return n >= MAX_RELOADS ? { act: 'stuck', n } : { act: 'reload', n: n + 1 };
}

/** The address to reload to: this one, marked; the #fragment stays. */
export function reloadURL(href, target, n) {
  const u = new URL(href);
  u.searchParams.set('follow', `${n}~${target}`);
  return u.toString();
}

/** The address without the mark (put back once the page has read it). */
export function cleanURL(href) {
  const u = new URL(href);
  u.searchParams.delete('follow');
  return u.pathname + u.search + u.hash;
}
