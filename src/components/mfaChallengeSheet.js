import { openModal, closeModal } from "./modal.js";
import {
  needsMfaChallenge,
  getChallengeFactor,
  challengeAndVerifyTotp,
  verifyRecoveryCode,
  unenrollTotp,
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

  renderCodeStep(factor.id, onPassed);
}

function renderCodeStep(factorId, onPassed, error) {
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
    <button class="delete-account-link" id="mfaUseRecoveryBtn" style="margin-top:12px;">Lost your authenticator? Use a recovery code</button>
  `,
    () => {},
  ); // deliberately not dismissible by clicking outside — only the buttons above move forward

  const codeInput = document.getElementById("mfaCode");
  codeInput.focus();

  document.getElementById("mfaSignOutBtn").onclick = async () => {
    await signOut();
    closeModal();
  };

  document.getElementById("mfaUseRecoveryBtn").onclick = () => {
    renderRecoveryStep(factorId, onPassed);
  };

  document.getElementById("mfaVerifyBtn").onclick = async () => {
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      renderCodeStep(
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
      renderCodeStep(
        factorId,
        onPassed,
        e.message || "That code was incorrect or expired. Try again.",
      );
    }
  };
}

function renderRecoveryStep(factorId, onPassed, error) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Use a recovery code</h3>
    <p class="auth-message">Enter one of the one-time codes you saved when you set up 2FA. Using one turns 2FA off — you'll want to set it up again once you have a working authenticator.</p>
    <div class="field">
      <label>Recovery code</label>
      <input id="mfaRecoveryCode" type="text" placeholder="XXXX-XXXX" autocomplete="off" style="text-transform:uppercase;font-family:'IBM Plex Mono',monospace;letter-spacing:0.1em;text-align:center;font-size:16px;"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="mfaBackBtn">Back to code entry</button>
      <button class="btn btn-primary" id="mfaRecoveryVerifyBtn">Verify</button>
    </div>
  `,
    () => {},
  );

  document.getElementById("mfaBackBtn").onclick = () =>
    renderCodeStep(factorId, onPassed);

  document.getElementById("mfaRecoveryVerifyBtn").onclick = async () => {
    const code = document.getElementById("mfaRecoveryCode").value.trim();
    if (!code) {
      renderRecoveryStep(
        factorId,
        onPassed,
        "Enter one of your recovery codes.",
      );
      return;
    }
    const btn = document.getElementById("mfaRecoveryVerifyBtn");
    btn.disabled = true;
    btn.textContent = "Verifying…";
    try {
      const valid = await verifyRecoveryCode(code);
      if (!valid) {
        renderRecoveryStep(
          factorId,
          onPassed,
          "That code didn't match, or it's already been used. Double-check for typos.",
        );
        return;
      }
      // A recovery code isn't real TOTP proof, so there's no way to upgrade
      // this session to aal2 — instead, this removes the second factor
      // entirely (same pattern GitHub/Google use), which naturally means no
      // more challenge is needed to proceed.
      try {
        await unenrollTotp(factorId);
      } catch (unenrollError) {
        // The code was valid and is now consumed, but removing the factor
        // itself failed — most likely Supabase requires a fully-verified
        // (aal2) session to unenroll, which this recovery-code path can't
        // reach on its own. Being explicit about this rather than pretending
        // it worked: the person's identity was confirmed, but they'll need
        // to sign in again and reach out for help clearing the old factor.
        renderRecoveryStep(
          factorId,
          onPassed,
          "Your code was verified, but removing 2FA didn't go through (" +
            (unenrollError.message || "unknown error") +
            "). Please try signing in again, or contact support if this keeps happening.",
        );
        return;
      }
      closeModal();
      onPassed();
    } catch (e) {
      renderRecoveryStep(
        factorId,
        onPassed,
        e.message ||
          "Something went wrong verifying that code. Please try again.",
      );
    }
  };
}
