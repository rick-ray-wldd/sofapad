// SOFA-13: typing on an upright iPhone squeezed the page (the landscape layout, a big empty band above the keyboard).
// The page asked for interactive-widget=resizes-content, which iOS 27.3 beta now honors; and the keyboard check
// compared with innerHeight, which iOS 27 shrinks with the visual viewport. Browser-level: tools/sofa13-typing.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keyboardUp, KEYBOARD_MIN } from '../js/viewport.js';

const viewportMeta = () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  return /<meta name="viewport" content="([^"]*)"/.exec(html)[1];
};

test('the page asks the keyboard to shrink only the visual viewport, never the layout viewport', () => {
  const content = viewportMeta();
  assert.match(content, /(^|,\s*)interactive-widget=resizes-visual(\s*,|$)/);
  assert.doesNotMatch(content, /resizes-content/);
  assert.match(content, /viewport-fit=cover/);   // the rest stays as it was
});

test('keyboard up on iOS 27 Safari: the visual viewport against the layout viewport, not innerHeight', () => {
  // iOS 27.0 simulator, iPhone 17e, Safari tab, Zhuyin keyboard: innerHeight 699 → 363 with the visual viewport,
  // documentElement.clientHeight stays 699
  const ios27 = { visualHeight: 363, innerHeight: 363, layoutHeight: 699 };
  assert.equal(keyboardUp({ typing: true, ...ios27 }), true);
  assert.equal(keyboardUp({ typing: true, visualHeight: ios27.visualHeight, layoutHeight: ios27.innerHeight }), false,
    '4.5.1 compared with innerHeight and never saw this keyboard');
  assert.equal(keyboardUp({ typing: false, ...ios27 }), false, 'no focus: not typing, whatever the sizes');
});

test('keyboard down: equal heights, the ~24 px iOS leaves after closing (S-105), no visual viewport', () => {
  assert.equal(keyboardUp({ typing: true, visualHeight: 699, layoutHeight: 699 }), false);
  assert.equal(keyboardUp({ typing: true, visualHeight: 675, layoutHeight: 699 }), false);
  assert.equal(keyboardUp({ typing: true, visualHeight: 699 - KEYBOARD_MIN, layoutHeight: 699 }), false);
  assert.equal(keyboardUp({ typing: true, visualHeight: undefined, layoutHeight: 699 }), false);
  // landscape, keyboard up (844×390 → about 190 visible)
  assert.equal(keyboardUp({ typing: true, visualHeight: 190, layoutHeight: 390 }), true);
});
