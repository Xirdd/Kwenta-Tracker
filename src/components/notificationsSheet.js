import { openModal, closeModal } from "./modal.js";
import {
  pushSupported,
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

  if (!pushSupported()) {
    openModal(
      `
      <div class="grabber"></div>
      <h3>Notifications</h3>
      <p class="auth-message">Push notifications aren't available in this browser. On iPhone, add Kwenta to your Home Screen first (Share → Add to Home Screen) and open it from there — iOS only allows push notifications for installed apps, not Safari tabs.</p>
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
