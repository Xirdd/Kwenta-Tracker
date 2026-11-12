// Large-title behaviour for the iOS look (see ios.css).
//
// The header renders a big title and, separately, a small fixed title bar that
// is invisible until the page has scrolled past the big one. All this file does
// is flip the `nav-collapsed` class on <html> at that point — the fade itself
// is CSS. It lives on <html>, not on the header, because main.js re-renders the
// whole app (header included) on every change, and the class has to survive that.

const THRESHOLD = 36; // px scrolled before the large title counts as gone
let ticking = false;

function update() {
  ticking = false;
  document.documentElement.classList.toggle(
    "nav-collapsed",
    window.scrollY > THRESHOLD,
  );
}

window.addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  },
  { passive: true },
);

update();
