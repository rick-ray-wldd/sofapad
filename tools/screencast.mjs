// Records a page with Chrome's own screencast (CDP Page.startScreencast) as JPEG frames plus an ffmpeg concat list that
// holds each frame on screen until the next one came. Playwright's recordVideo needs an ffmpeg it downloads; this uses
// the system ffmpeg, only when the frames are encoded (SOFA-8 demo videos).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {import('playwright-core').Page} page
 * @param {string} dir  where the frames go
 * @param {{t0?: number, maxWidth?: number, maxHeight?: number}} [o]  t0: seconds since the epoch the video starts at
 *   (the first frame is held from then), so videos of several pages line up
 */
export async function startScreencast(page, dir, { t0 = Date.now() / 1000, maxWidth, maxHeight } = {}) {
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(dir, `f${String(frames.length).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* page gone */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1, ...(maxWidth ? { maxWidth } : {}), ...(maxHeight ? { maxHeight } : {}) });
  return {
    /** Stops, writes `list.txt` (ffmpeg concat demuxer) and returns its path, or null without frames. */
    async stop(end = Date.now() / 1000) {
      try { await cdp.send('Page.stopScreencast'); } catch { /* page gone */ }
      if (!frames.length) return null;
      // durations from rounded running times, so thousands of frames do not add up rounding (a 4 s drift otherwise)
      const at = (i) => Math.round((Math.max(t0, i < frames.length ? frames[i].t : end) - t0) * 1000);
      const lines = frames.map((f, i) => `file '${f.file}'\nduration ${(Math.max(1, at(i + 1) - (i === 0 ? 0 : at(i))) / 1000).toFixed(3)}\n`);
      lines.push(`file '${frames.at(-1).file}'\n`);
      const list = join(dir, 'list.txt');
      writeFileSync(list, lines.join(''));
      writeFileSync(join(dir, 'frames.json'), JSON.stringify({ t0, end, t: frames.map((f) => f.t) }));
      return list;
    },
  };
}
