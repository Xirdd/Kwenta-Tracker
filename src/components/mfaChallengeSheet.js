import { openModal, closeModal } from "./modal.js";
import {
  needsMfaChallenge,
  getChallengeFactor,
  challengeAndVerifyTotp,
} from "../mfa.js";
import { signOut } from "../auth.js";

// Call after any successful first-factor sign-in (password or magic link,
// including the magic-link landing on page load). If the account has 2FA
// enabled and this session hasn't completed it yet, shows a non-dismissible
// code prompt and only calls onPassed() once the code checks out. If 2FA
// isn't enabled — the common case — calls onPassed() immediately with no
// visible prompt at all.
export async function requireMfaIfNeeded(onPassed) {
  let needsChallenge;
  try {
    needsChallenge = await needsMfaChallenge();
  } catch (e) {
    needsChallenge = false;
  }
  if (!needsChallenge) {
    onPassed();
    return;
  }

  let factor;
  try {
    factor = await getChallengeFactor();
  } catch (e) {
    factor = null;
  }
  if (!factor) {
    onPassed();
    return;
  } // shouldn't happen, but don't hard-lock someone out if it does

  render(factor.id, onPassed);
}

function render(factorId, onPassed, error) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Enter your 2FA code</h3>
    <p class="auth-message">Open your authenticator app and enter the 6-digit code for Kwenta.</p>
    <div class="field">
      <label>Code</label>
      <input id="mfaCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" autocomplete="one-time-code" class="mfa-code-input"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="mfaSignOutBtn">Sign out instead</button>
      <button class="btn btn-primary" id="mfaVerifyBtn">Verify</button>
    </div>
  `,
    () => {},
  ); // deliberately not dismissible by clicking outside — only "Verify" or "Sign out" move forward

  const codeInput = document.getElementById("mfaCode");
  codeInput.focus();

  document.getElementById("mfaSignOutBtn").onclick = async () => {
    await signOut();
    closeModal();
  };

  document.getElementById("mfaVerifyBtn").onclick = async () => {
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      render(
        factorId,
        onPassed,
        "Enter the 6-digit code from your authenticator app.",
      );
      return;
    }
    const btn = document.getElementById("mfaVerifyBtn");
    btn.disabled = true;
    btn.textContent = "Verifying…";
    try {
      await challengeAndVerifyTotp(factorId, code);
      closeModal();
      onPassed();
    } catch (e) {
      render(
        factorId,
        onPassed,
        e.message || "That code was incorrect or expired. Try again.",
      );
    }
  };
}
