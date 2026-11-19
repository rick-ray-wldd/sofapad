// SOFA-13: is the phone's on-screen keyboard really up? (D-14, S-105)
//
// Focus on the text box, and the visual viewport clearly shorter than the layout viewport. The layout viewport is
// documentElement.clientHeight: with the keyboard up, iOS 27 Safari shrinks innerHeight together with the visual
// viewport (iOS 27.0 simulator, iPhone 17e: innerHeight 699 → 363, clientHeight stays 699), so comparing with
// innerHeight, as 4.5.1 did, never saw the keyboard. iOS can leave a ~24 px difference after the keyboard closes
// (S-105), hence the margin.
export const KEYBOARD_MIN = 120;

export function keyboardUp({ typing, visualHeight, layoutHeight }) {
  return !!typing && typeof visualHeight === 'number' && visualHeight < layoutHeight - KEYBOARD_MIN;
}
