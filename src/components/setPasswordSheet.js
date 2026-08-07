import { openModal, closeModal } from "./modal.js";
import { updateUserPassword } from "../auth.js";

// context: 'auto' (shown automatically right after a magic-link signup) or
// 'manual' (opened deliberately from Profile → Change password).
export function openSetPasswordSheet({ context = "auto" } = {}) {
  render(undefined, context);
}

function render(message, context) {
  const isAuto = context === "auto";
  openModal(
    `
    <div class="grabber"></div>
    <h3>${isAuto ? "Secure your account" : "Change your password"}</h3>
    <p class="auth-message">${
      isAuto
        ? "You signed up with a magic link. Set a password now so you can sign in anytime without waiting on an email."
        : "Set a new password for signing in — this works whether you already have one or you've only ever used a magic link."
    }</p>
    <div class="field">
      <label>Password</label>
      <input id="newPassword" type="password" placeholder="At least 6 characters" autocomplete="new-password"/>
    </div>
    <div class="field">
      <label>Confirm password</label>
      <input id="confirmPassword" type="password" placeholder="Re-enter your password" autocomplete="new-password"/>
    </div>
    ${message ? `<p class="auth-message">${message}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="skipPasswordBtn">${isAuto ? "Skip for now" : "Cancel"}</button>
      <button class="btn btn-primary" id="setPasswordBtn">${isAuto ? "Set password" : "Update password"}</button>
    </div>
  `,
    closeModal,
  );

  document.getElementById("skipPasswordBtn").onclick = closeModal;

  document.getElementById("setPasswordBtn").onclick = async () => {
    const password = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    if (password.length < 6) {
      render("Password needs to be at least 6 characters.", context);
      return;
    }
    if (password !== confirm) {
      render("Those two passwords don't match — try again.", context);
      return;
    }
    try {
      await updateUserPassword(password);
      closeModal();
    } catch (e) {
      render(
        e.message || "Could not set your password. Please try again.",
        context,
      );
    }
  };
}
