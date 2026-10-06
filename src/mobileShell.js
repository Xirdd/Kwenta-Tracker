import "./mobile.css";

// Zoom lock, part 2 (the JavaScript half). The viewport meta tag and
// `touch-action: manipulation` (index.html / mobile.css) do most of the work;
// these cover what they don't:
//
// 1. Pinch zoom on iOS Safari / installed web apps. iOS ignores
//    user-scalable=no for pinch, but it fires non-standard "gesture" events
//    while a pinch is happening — cancelling them stops the zoom.
//
// 2. A quick double tap on non-interactive areas (text, gaps between
//    controls), which iOS still occasionally zooms. Distance-checked on
//    purpose — two quick taps on DIFFERENT places are never a double tap.
//
//    IMPORTANT: taps on controls are deliberately left alone. The earlier
//    version cancelled the second tap of ANY quick same-spot pair, which also
//    swallowed the click — so tapping the same keypad digit twice quickly
//    ("1", "1" on the App Lock screen) lost the second press. Controls can't
//    trigger double-tap zoom anyway (touch-action: manipulation), so there's
//    nothing to protect there.

["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), {
    passive: false,
  });
});

const INTERACTIVE =
  'button, a, input, select, textarea, label, summary, [role="button"], [data-key], .row, .bill-row, .goal-card, .loan-card, .cat-opt, .budget-header, .settings-row, .tab-btn, .bottom-nav-btn, .lock-key';

let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;

document.addEventListener(
  "touchend",
  (e) => {
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const now = Date.now();
    const onControl =
      e.target instanceof Element && e.target.closest(INTERACTIVE);
    const near =
      Math.abs(touch.clientX - lastTapX) < 30 &&
      Math.abs(touch.clientY - lastTapY) < 30;
    if (!onControl && now - lastTapTime < 350 && near) e.preventDefault();
    lastTapTime = now;
    lastTapX = touch.clientX;
    lastTapY = touch.clientY;
  },
  { passive: false },
);
