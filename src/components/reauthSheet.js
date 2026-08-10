import { openModal, closeModal } from "./modal.js";
import { getCurrentUser, signInWithPassword } from "../auth.js";

// Opens a "confirm your password" gate before a sensitive action, calling
// onConfirmed() only after the password is verified with a fresh
// signInWithPassword call — this re-validates identity without disrupting
// the existing session (main.js's change-detection guard ignores the
// resulting auth event since the user id hasn't actually changed).
//
// Includes a deliberate escape hatch for magic-link-only accounts that have
// no password to confirm. Supabase returns the same generic error for
// "wrong password" and "no password set" (by design — distinguishing them
// would leak which emails have a password), so there's no reliable way to
// detect that case ahead of time and skip the prompt automatically. This is
// a pragmatic tradeoff for a personal-scale app, not a perfect gate — worth
// knowing if this pattern gets reused somewhere higher-stakes later.
export function requirePasswordConfirmation(
  onConfirmed,
  { title = "Confirm your password", message } = {},
) {
  render(onConfirmed, title, message);
}

function render(onConfirmed, title, message, error) {
  const user = getCurrentUser();

  openModal(
    `
    <div class="grabber"></div>
    <h3>${title}</h3>
    <p class="auth-message">${message || "For your security, re-enter your password to continue."}</p>
    <div class="field">
      <label>Password</label>
      <input id="reauthPassword" type="password" placeholder="Your current password" autocomplete="current-password"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="reauthCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="reauthConfirmBtn">Confirm</button>
    </div>
    <button class="delete-account-link" id="reauthNoPasswordBtn" style="margin-top:12px;">I signed up via magic link — I don't have a password</button>
  `,
    closeModal,
  );

  document.getElementById("reauthCancelBtn").onclick = closeModal;

  document.getElementById("reauthNoPasswordBtn").onclick = () => {
    closeModal();
    onConfirmed(); // nothing to verify against — falls back to trusting the existing session
  };

  document.getElementById("reauthConfirmBtn").onclick = async () => {
    const password = document.getElementById("reauthPassword").value;
    if (!password) {
      render(onConfirmed, title, message, "Enter your password to continue.");
      return;
    }
    const btn = document.getElementById("reauthConfirmBtn");
    btn.disabled = true;
    btn.textContent = "Confirming…";
    try {
      await signInWithPassword(user.email, password);
      closeModal();
      onConfirmed();
    } catch (e) {
      render(
        onConfirmed,
        title,
        message,
        "That password didn't match — try again, or use the link below if you don't have one set.",
      );
    }
  };
}
