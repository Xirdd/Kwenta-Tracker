import { openModal, closeModal } from "./modal.js";
import { verifyCurrentPassword } from "../auth.js";
import { escapeHtml } from "../format.js";

// Opens a "confirm your password" gate before a sensitive action, calling
// onConfirmed() only after the password is verified.
//
// Verification happens on the server (verify_my_password in
// supabase/phase2_security.sql) and never touches the current session — the
// old approach re-signed-in from the browser, which swapped a 2FA session for
// a fresh aal1 one and, once 2FA is enforced by RLS, would have locked the
// person out of their own data afterwards.
//
// There is deliberately NO "I signed up via magic link" escape hatch any
// more: every account is created with a password, so that button was only a
// way to skip the check. An older account that really has no password is told
// how to create one (Forgot password? on the login page).
export function requirePasswordConfirmation(
  onConfirmed,
  { title = "Confirm your password", message } = {},
) {
  render(onConfirmed, title, message);
}

function render(onConfirmed, title, message, error) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>${escapeHtml(title)}</h3>
    <p class="auth-message">${escapeHtml(message || "For your security, re-enter your password to continue.")}</p>
    <div class="field">
      <label>Password</label>
      <input id="reauthPassword" type="password" placeholder="Your current password" autocomplete="current-password"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${escapeHtml(error)}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="reauthCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="reauthConfirmBtn">Confirm</button>
    </div>
  `,
    closeModal,
  );

  document.getElementById("reauthCancelBtn").onclick = closeModal;

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
      const ok = await verifyCurrentPassword(password);
      if (!ok) {
        render(
          onConfirmed,
          title,
          message,
          "That password didn't match — try again.",
        );
        return;
      }
      closeModal();
      onConfirmed();
    } catch (e) {
      // "Too many attempts", "no password set", or a network problem.
      render(
        onConfirmed,
        title,
        message,
        e.message || "Couldn't check your password. Please try again.",
      );
    }
  };
}
