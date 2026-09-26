import "./mobile.css";

// Double-tap-to-zoom. style.css already sets `touch-action: manipulation`,
// which is supposed to stop it, but iOS still zooms on a quick double tap in
// some cases (text, gaps between controls). This is the belt-and-braces
// version: if a second tap lands close to the first within 350ms, cancel it.
// Distance-checked on purpose — two quick taps on DIFFERENT buttons (e.g.
// hammering + then Save) are never treated as a double tap.
//
// Pinch-to-zoom is deliberately left alone — it's an accessibility feature.
let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;

document.addEventListener(
  "touchend",
  (e) => {
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const now = Date.now();
    const near =
      Math.abs(touch.clientX - lastTapX) < 30 &&
      Math.abs(touch.clientY - lastTapY) < 30;
    if (now - lastTapTime < 350 && near) e.preventDefault();
    lastTapTime = now;
    lastTapX = touch.clientX;
    lastTapY = touch.clientY;
  },
  { passive: false },
);
