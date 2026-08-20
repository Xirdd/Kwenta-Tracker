import { openModal, closeModal } from "./modal.js";
import {
  pushCapability,
  pushPermissionState,
  isPushSubscribed,
  enablePush,
  disablePush,
} from "../push.js";

export async function openNotificationsSheet() {
  openModal(
    `<div class="grabber"></div><h3>Notifications</h3><p class="auth-message">Loading…</p>`,
    closeModal,
  );

  const capability = pushCapability();
  if (capability !== "ok") {
    openModal(
      `
      <div class="grabber"></div>
      <h3>Notifications</h3>
      <p class="auth-message">${capabilityMessage(capability)}</p>
      <div class="sheet-actions"><button class="btn btn-ghost" id="notifCloseBtn">Close</button></div>
    `,
      closeModal,
    );
    document.getElementById("notifCloseBtn").onclick = closeModal;
    return;
  }

  const permission = pushPermissionState();
  const subscribed = await isPushSubscribed();
  render(permission, subscribed);
}

function capabilityMessage(capability) {
  if (capability === "no-vapid-key") {
    return "Notifications aren't set up yet on this deployment — VITE_VAPID_PUBLIC_KEY is missing from the app's environment variables. This is a configuration step, not a browser limitation — add it to your .env file (or your host's environment variable settings if this is a live deployment) and rebuild.";
  }
  if (capability === "no-push-api") {
    return "This browser doesn't support push notifications. On iPhone, make sure you've added Kwenta to your Home Screen (Share → Add to Home Screen) and are opening it from that icon, not from Safari directly — and that you're on iOS 16.4 or later, which is required for installed web apps to receive push notifications.";
  }
  return "Push notifications aren't available in this browser.";
}

function render(permission, subscribed, error) {
  const isOn = subscribed && permission === "granted";
  const isDenied = permission === "denied";

  openModal(
    `
    <div class="grabber"></div>
    <h3>Notifications</h3>
    <p class="auth-message">${
      isDenied
        ? "Notifications are blocked for this site in your browser's settings — you'll need to allow them there before Kwenta can send any."
        : isOn
          ? "You'll get a push notification when a bill is coming due, or when you go over a category's budget for the month — even if Kwenta isn't open."
          : "Get a push notification when a bill is coming due, or when you go over a category's budget for the month — even if Kwenta isn't open."
    }</p>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="notifCloseBtn">Close</button>
      ${isDenied ? "" : `<button class="btn ${isOn ? "btn-danger" : "btn-primary"}" id="notifToggleBtn">${isOn ? "Turn off" : "Turn on"}</button>`}
    </div>
  `,
    closeModal,
  );

  document.getElementById("notifCloseBtn").onclick = closeModal;

  const toggleBtn = document.getElementById("notifToggleBtn");
  if (toggleBtn) {
    toggleBtn.onclick = async () => {
      toggleBtn.disabled = true;
      toggleBtn.textContent = isOn ? "Turning off…" : "Turning on…";
      try {
        if (isOn) {
          await disablePush();
          render("granted", false);
        } else {
          await enablePush();
          render("granted", true);
        }
      } catch (e) {
        render(
          permission,
          subscribed,
          e.message || "Something went wrong. Please try again.",
        );
      }
    };
  }
}
