import { openModal, closeModal } from "./modal.js";
import {
  enrollTotp,
  verifyTotpEnrollment,
  listTotpFactors,
  unenrollTotp,
  generateRecoveryCodes,
  countRemainingRecoveryCodes,
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

async function renderEnabled(factor) {
  openModal(
    `<div class="grabber"></div><h3>Two-factor authentication</h3><p class="auth-message">Loading…</p>`,
    closeModal,
  );

  let remaining;
  try {
    remaining = await countRemainingRecoveryCodes();
  } catch (e) {
    remaining = null; // don't block the whole screen over this — just omit the count
  }

  openModal(
    `
    <div class="grabber"></div>
    <h3>Two-factor authentication</h3>
    <p class="auth-message">Enabled — signing in needs a code from your authenticator app, in addition to your password.</p>
    <div class="profile-card" style="margin:14px 0;">
      <div class="profile-row">
        <div>
          <div class="profile-label">Recovery codes</div>
          <div class="profile-value">${remaining === null ? "Unable to check right now" : `${remaining} unused code${remaining === 1 ? "" : "s"} remaining`}</div>
        </div>
        <button class="btn btn-ghost" id="mfaRegenerateBtn">Regenerate</button>
      </div>
    </div>
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

  document.getElementById("mfaRegenerateBtn").onclick = () => {
    requirePasswordConfirmation(() => regenerateCodes(factor), {
      title: "Confirm your password",
      message:
        "Regenerating recovery codes invalidates your old ones — confirm it's really you first.",
    });
  };
}

async function regenerateCodes(factor) {
  openModal(
    `<div class="grabber"></div><h3>Recovery codes</h3><p class="auth-message">Generating new codes…</p>`,
    closeModal,
  );
  try {
    const codes = await generateRecoveryCodes();
    renderRecoveryCodes(
      codes,
      factor,
      "Your old recovery codes no longer work — only this new set is valid now.",
    );
  } catch (e) {
    renderLoadError(
      e.message || "Could not generate new codes. Please try again.",
    );
  }
}

function confirmDisable(factor, error) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Disable 2FA?</h3>
    <p class="auth-message">Your account will only need a password to sign in after this. Your recovery codes will stop working too.</p>
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
    <p class="auth-message">Works with Google Authenticator, Microsoft Authenticator, Authy, 1Password, your iPhone's built-in authenticator (Settings → Passwords → Set Up Verification Code), or any similar app — then enter the 6-digit code it shows.</p>
    <div class="mfa-qr-wrap"><img src="${enrollment.qrCodeSvg}" alt="2FA setup QR code" class="mfa-qr-img"/></div>
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
      // 2FA is now active — generate recovery codes immediately, since this
      // is the only moment a person can reasonably be asked to save them
      // (they can't be regenerated-and-viewed later without this same flow).
      const codes = await generateRecoveryCodes();
      renderRecoveryCodes(codes, { id: enrollment.factorId }, null, true);
    } catch (e) {
      renderScanStep(
        enrollment,
        e.message || "That code was incorrect. Try again.",
      );
    }
  };
}

function renderRecoveryCodes(codes, factor, note, isFirstTime) {
  const codeList = codes
    .map((c) => `<div class="recovery-code">${c}</div>`)
    .join("");
  openModal(
    `
    <div class="grabber"></div>
    <h3>${isFirstTime ? "2FA is on — save these first" : "New recovery codes"}</h3>
    <p class="auth-message">Each code works once, if you ever lose access to your authenticator app. ${note || "Save these somewhere safe — you won't be able to see them again."}</p>
    <div class="recovery-code-grid">${codeList}</div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="recoveryCopyBtn">Copy all</button>
      <button class="btn btn-primary" id="recoveryDoneBtn">${isFirstTime ? "I've saved these" : "Done"}</button>
    </div>
  `,
    () => {},
  ); // not dismissible by clicking outside — these need to actually be saved, not accidentally skipped

  document.getElementById("recoveryCopyBtn").onclick = async () => {
    const btn = document.getElementById("recoveryCopyBtn");
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy all";
      }, 1500);
    } catch (e) {
      btn.textContent = "Couldn't copy";
      setTimeout(() => {
        btn.textContent = "Copy all";
      }, 1500);
    }
  };

  document.getElementById("recoveryDoneBtn").onclick = () => {
    closeModal();
    onChange();
  };
}
