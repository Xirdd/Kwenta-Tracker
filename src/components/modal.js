// The one modal/sheet used by every dialog in the app (openModal re-renders it
// in place for multi-step flows). Accessibility behaviour lives here so every
// dialog gets it without changing a single caller:
//
//  - role="dialog" + aria-modal, labelled by the dialog's heading
//  - Escape closes it — by calling the SAME handler a tap on the dimmed
//    background calls, so dialogs that are deliberately not dismissible (the
//    2FA code prompt, recovery codes) stay non-dismissible with the keyboard too
//  - Tab / Shift+Tab stay inside the dialog (focus trap)
//  - the page behind is made `inert` while it's open, so neither keyboard nor
//    screen reader can wander into it
//  - focus moves into the dialog on open and returns to whatever opened it on close
//  - a closed sheet is `inert` too, so its leftover controls aren't tabbable

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let isOpen = false;
let returnFocusTo = null;
let currentDismiss = closeModal;

function scrimEl() {
  return document.getElementById("scrim");
}
function sheetEl() {
  return document.getElementById("sheet");
}

// Everything behind the dialog. #authGate only exists while the login page is
// up (the 2FA prompt opens on top of it).
function setBackgroundInert(on) {
  ["app", "authGate"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    }
  });
}

function labelDialog(sheet) {
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("tabindex", "-1");
  sheet.querySelectorAll(".grabber").forEach((g) => {
    g.setAttribute("aria-hidden", "true");
  });
  const heading = sheet.querySelector("h3, h2");
  if (heading) {
    if (!heading.id) heading.id = "sheetTitle";
    sheet.setAttribute("aria-labelledby", heading.id);
    sheet.removeAttribute("aria-label");
  } else {
    sheet.removeAttribute("aria-labelledby");
    sheet.setAttribute(
      "aria-label",
      sheet.querySelector('input[type="search"]') ? "Search" : "Dialog",
    );
  }
}

export function openModal(html, onScrimClick) {
  const sheet = sheetEl();
  const scrim = scrimEl();

  // Remember what had focus only on the first open — multi-step dialogs call
  // openModal again for each step while already open.
  if (!isOpen) {
    returnFocusTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  sheet.innerHTML = html;
  currentDismiss = onScrimClick || closeModal;
  scrim.onclick = currentDismiss;
  scrim.setAttribute("aria-hidden", "true");

  labelDialog(sheet);
  sheet.removeAttribute("inert");
  sheet.removeAttribute("aria-hidden");
  scrim.classList.add("show");
  sheet.classList.add("show");
  setBackgroundInert(true);
  isOpen = true;

  // Focus the dialog itself, not its first field: that puts a screen reader
  // inside the dialog and starts the Tab trap without popping the on-screen
  // keyboard. Dialogs that want a field focused (search, 2FA code) already
  // call .focus() on it right after openModal returns.
  sheet.focus({ preventScroll: true });
}

export function closeModal() {
  const sheet = sheetEl();
  scrimEl().classList.remove("show");
  sheet.classList.remove("show");
  sheet.setAttribute("inert", "");
  sheet.setAttribute("aria-hidden", "true");
  setBackgroundInert(false);

  const wasOpen = isOpen;
  isOpen = false;
  currentDismiss = closeModal;

  // Give focus back to whatever opened the dialog — if it's still on the page
  // (a re-render usually replaces it, in which case there's nothing to restore).
  if (wasOpen && returnFocusTo && returnFocusTo.isConnected) {
    try {
      returnFocusTo.focus({ preventScroll: true });
    } catch (e) {
      /* ignore */
    }
  }
  returnFocusTo = null;
}

function visible(el) {
  return el.offsetParent !== null || el === document.activeElement;
}

document.addEventListener("keydown", (e) => {
  if (!isOpen) return;
  const sheet = sheetEl();

  if (e.key === "Escape") {
    e.preventDefault();
    currentDismiss();
    return;
  }

  if (e.key !== "Tab") return;
  const nodes = [...sheet.querySelectorAll(FOCUSABLE)].filter(visible);
  if (nodes.length === 0) {
    e.preventDefault();
    sheet.focus();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;

  if (!sheet.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && (active === first || active === sheet)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
});

// Start closed: nothing inside the (empty, off-screen) sheet should be tabbable.
(function initClosedState() {
  const sheet = sheetEl();
  if (sheet && !sheet.classList.contains("show")) {
    sheet.setAttribute("inert", "");
    sheet.setAttribute("aria-hidden", "true");
  }
})();
