import "./notices.css";
import { registerSW } from "virtual:pwa-register";
import { pendingSyncCount } from "./syncQueue.js";

// Two small banners stacked at the top of the screen:
//
//  1. Offline / unsynced — "You're offline…" while the device has no
//     connection, and "N changes waiting to sync" while anything is still in
//     the retry queue (syncQueue.js) even once back online.
//  2. Update available — a new version of the app has been downloaded and is
//     waiting. With registerType "prompt" (vite.config.js) it does NOT swap in
//     under a page that's still running the old code; tapping Update tells the
//     waiting service worker to take over and reloads.
//
// All text is set with textContent (never innerHTML).

let stack = null;
let offlineEl = null;
let offlineText = null;
let updateEl = null;
let updateSW = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el("button", className, label);
  b.type = "button";
  b.onclick = onClick;
  return b;
}

function buildStack() {
  if (stack) return;
  stack = el("div");
  stack.id = "noticeStack";

  offlineEl = el("div", "notice notice-offline");
  offlineEl.setAttribute("role", "status");
  offlineEl.setAttribute("aria-live", "polite");
  offlineEl.hidden = true;
  offlineText = el("span", "notice-text");
  offlineEl.appendChild(offlineText);

  updateEl = el("div", "notice notice-update");
  updateEl.setAttribute("role", "alert");
  updateEl.hidden = true;
  updateEl.appendChild(
    el("span", "notice-text", "A new version of Kwenta is ready."),
  );
  const actions = el("span", "notice-actions");
  const updateBtn = button("Update", "notice-btn", () => {
    updateBtn.disabled = true;
    updateBtn.textContent = "Updating…";
    if (updateSW) updateSW(true); // activates the waiting worker, then reloads
  });
  actions.appendChild(updateBtn);
  actions.appendChild(
    button("Later", "notice-btn secondary", () => {
      updateEl.hidden = true;
    }),
  );
  updateEl.appendChild(actions);

  stack.appendChild(offlineEl);
  stack.appendChild(updateEl);
  document.body.appendChild(stack);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function refreshOffline() {
  const online = navigator.onLine !== false;
  const pending = pendingSyncCount();

  if (!online) {
    offlineText.textContent =
      pending > 0
        ? `You're offline — ${plural(pending, "change")} waiting to sync.`
        : "You're offline — changes are saved on this device and will sync when you're back.";
    offlineEl.hidden = false;
  } else if (pending > 0) {
    offlineText.textContent = `${plural(pending, "change")} waiting to sync — retrying automatically.`;
    offlineEl.hidden = false;
  } else {
    offlineEl.hidden = true;
  }
}

// Call once at startup.
export function initNotices() {
  buildStack();

  refreshOffline();
  window.addEventListener("online", refreshOffline);
  window.addEventListener("offline", refreshOffline);
  setInterval(refreshOffline, 5000); // picks up the queue draining or filling

  // The service worker only exists in a production build.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    try {
      updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          updateEl.hidden = false;
        },
        onRegisteredSW(_url, registration) {
          // Look for a new version hourly while the app stays open (a PWA on a
          // phone can go days without a real page load).
          if (registration) {
            setInterval(
              () => registration.update().catch(() => {}),
              60 * 60 * 1000,
            );
          }
        },
      });
    } catch (e) {
      console.error("Service worker registration failed", e);
    }
  }
}
