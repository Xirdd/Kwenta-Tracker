import { openModal, closeModal } from "./modal.js";
import {
  enrollTotp,
  verifyTotpEnrollment,
  listTotpFactors,
  unenrollTotp,
} from "../mfa.js";
import { requirePasswordConfirmation } from "./reauthSheet.js";

let onChange = () => {};

export function initMfaSetupSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export async function openMfaSetupSheet() {
  openModal(
    `<div class="grabber"></div><h3>Two-factor authentication</h3><p class="auth-message">Loading…</p>`,
    closeModal,
  );

  let factors;
  try {
    factors = await listTotpFactors();
  } catch (e) {
    renderLoadError(e.message || "Couldn't load your 2FA status right now.");
    return;
  }

  if (factors.length > 0) renderEnabled(factors[0]);
  else renderEnrollStart();
}

function renderLoadError(message) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Two-factor authentication</h3>
    <p class="auth-message" style="color:var(--coral);">${message}</p>
    <div class="sheet-actions"><button class="btn btn-ghost" id="mfaCloseBtn">Close</button></div>
  `,
    closeModal,
  );
  document.getElementById("mfaCloseBtn").onclick = closeModal;
}

function renderEnabled(factor) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Two-factor authentication</h3>
    <p class="auth-message">Enabled — signing in needs a code from your authenticator app, in addition to your password.</p>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="mfaCloseBtn">Close</button>
      <button class="btn btn-danger" id="mfaDisableBtn">Disable 2FA</button>
    </div>
  `,
    closeModal,
  );
  document.getElementById("mfaCloseBtn").onclick = closeModal;
  document.getElementById("mfaDisableBtn").onclick = () => {
    requirePasswordConfirmation(() => confirmDisable(factor), {
      title: "Confirm your password",
      message:
        "Turning off 2FA weakens your account's security — confirm it's really you first.",
    });
  };
}

function confirmDisable(factor, error) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Disable 2FA?</h3>
    <p class="auth-message">Your account will only need a password to sign in after this.</p>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="mfaKeepBtn">Keep it on</button>
      <button class="btn btn-danger" id="mfaConfirmDisableBtn">Disable</button>
    </div>
  `,
    closeModal,
  );
  document.getElementById("mfaKeepBtn").onclick = closeModal;
  document.getElementById("mfaConfirmDisableBtn").onclick = async () => {
    const btn = document.getElementById("mfaConfirmDisableBtn");
    btn.disabled = true;
    btn.textContent = "Disabling…";
    try {
      await unenrollTotp(factor.id);
      closeModal();
      onChange();
    } catch (e) {
      confirmDisable(
        factor,
        e.message || "Could not disable 2FA. Please try again.",
      );
    }
  };
}

async function renderEnrollStart() {
  openModal(
    `<div class="grabber"></div><h3>Two-factor authentication</h3><p class="auth-message">Setting up…</p>`,
    closeModal,
  );
  let enrollment;
  try {
    enrollment = await enrollTotp();
  } catch (e) {
    renderLoadError(e.message || "Could not start setup. Please try again.");
    return;
  }
  renderScanStep(enrollment);
}

function renderScanStep(enrollment, error) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Scan with your authenticator app</h3>
    <p class="auth-message">Use Google Authenticator, Authy, 1Password, or similar — then enter the 6-digit code it shows.</p>
    <div class="mfa-qr-wrap">${enrollment.qrCodeSvg}</div>
    <p class="mfa-secret-fallback">Can't scan? Enter this code manually: <code>${enrollment.secret}</code></p>
    <div class="field">
      <label>6-digit code</label>
      <input id="mfaEnrollCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" class="mfa-code-input"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="mfaCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="mfaVerifyEnrollBtn">Verify & enable</button>
    </div>
  `,
    closeModal,
  );

  document.getElementById("mfaCancelBtn").onclick = closeModal;

  document.getElementById("mfaVerifyEnrollBtn").onclick = async () => {
    const code = document.getElementById("mfaEnrollCode").value.trim();
    if (!/^\d{6}$/.test(code)) {
      renderScanStep(enrollment, "Enter the 6-digit code from your app.");
      return;
    }
    const btn = document.getElementById("mfaVerifyEnrollBtn");
    btn.disabled = true;
    btn.textContent = "Verifying…";
    try {
      await verifyTotpEnrollment(enrollment.factorId, code);
      closeModal();
      onChange();
    } catch (e) {
      renderScanStep(
        enrollment,
        e.message || "That code was incorrect. Try again.",
      );
    }
  };
}
