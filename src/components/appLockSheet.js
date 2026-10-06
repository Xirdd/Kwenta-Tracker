import { openModal, closeModal } from "./modal.js";
import { requirePasswordConfirmation } from "./reauthSheet.js";
import { getCurrentUser } from "../auth.js";
import { escapeHtml } from "../format.js";
import {
  isLockEnabled,
  setPin,
  clearLock,
  getLockType,
  lockTypeLabel,
  LOCK_TYPES,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  biometricAvailable,
  hasBiometricEnrolled,
  enrollBiometric,
  disableBiometric,
} from "../appLock.js";

let onChange = () => {};

export function initAppLockSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

// Which type is selected while creating a passcode. Reset to the simplest one
// each time the flow starts.
let chosenType = "pin4";

export function openAppLockSheet() {
  if (isLockEnabled()) {
    renderManage();
  } else {
    chosenType = "pin4";
    renderSetup("new");
  }
}

function validSecret(type, secret) {
  if (type === "pin4") return /^\d{4}$/.test(secret);
  if (type === "pin6") return /^\d{6}$/.test(secret);
  return (
    secret.length >= MIN_PASSWORD_LENGTH && secret.length <= MAX_PASSWORD_LENGTH
  );
}

function invalidMessage(type) {
  if (type === "pin4") return "A 4-digit PIN needs exactly 4 digits.";
  if (type === "pin6") return "A 6-digit PIN needs exactly 6 digits.";
  return `A password needs ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`;
}

// step: "new" (choose a type, enter it) or "confirm" (enter it again).
function renderSetup(step = "new", firstSecret, error) {
  const isConfirm = step === "confirm";
  const isPassword = chosenType === "password";
  const typeInfo = LOCK_TYPES.find((t) => t.id === chosenType);

  const inputAttrs = isPassword
    ? `type="password" autocomplete="new-password" maxlength="${MAX_PASSWORD_LENGTH}" placeholder="${isConfirm ? "Re-enter your password" : "Letters, numbers, symbols"}" autocapitalize="none" autocorrect="off" spellcheck="false"`
    : `type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="${typeInfo.length}" placeholder="${"•".repeat(typeInfo.length)}" class="mfa-code-input"`;

  openModal(`
    <div class="grabber"></div>
    <h3>${isConfirm ? "Confirm your passcode" : "Set a passcode"}</h3>
    <p class="auth-message">${
      isConfirm
        ? "Enter it once more to confirm."
        : "Choose how you want to unlock Kwenta on this device. It stays on this device only — it isn't part of your account."
    }</p>
    ${
      isConfirm
        ? ""
        : `
    <div class="field">
      <label>Security type</label>
      <div class="auth-tabs" id="lockTypeTabs" role="radiogroup" aria-label="Security type">
        ${LOCK_TYPES.map(
          (t) =>
            `<button type="button" class="auth-tab ${t.id === chosenType ? "active" : ""}" role="radio" aria-checked="${t.id === chosenType}" data-type="${t.id}">${escapeHtml(t.label)}</button>`,
        ).join("")}
      </div>
    </div>`
    }
    <div class="field">
      <label for="lockSecretInput">${isPassword ? "Password" : `${typeInfo.length}-digit PIN`}</label>
      <input id="lockSecretInput" ${inputAttrs}/>
      ${
        !isConfirm
          ? `<p class="field-hint">${
              isPassword
                ? `${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters. Letters, numbers and symbols all work.`
                : `Exactly ${typeInfo.length} digits — Kwenta unlocks as soon as you've typed the last one.`
            }</p>`
          : ""
      }
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${escapeHtml(error)}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="lockCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="lockNextBtn">${isConfirm ? "Confirm" : "Next"}</button>
    </div>
  `);

  // Switching type re-renders the field for that type (4 boxes, 6 boxes, or a
  // free-text password) — nothing typed yet is lost because nothing is typed.
  document.querySelectorAll("#lockTypeTabs [data-type]").forEach((btn) => {
    btn.onclick = () => {
      chosenType = btn.dataset.type;
      renderSetup("new");
    };
  });

  const input = document.getElementById("lockSecretInput");
  input.focus();
  document.getElementById("lockCancelBtn").onclick = closeModal;

  // PINs: keep only digits as they're typed, so a stray letter can't sneak in.
  if (!isPassword) {
    input.oninput = () => {
      input.value = input.value.replace(/\D/g, "").slice(0, typeInfo.length);
    };
  }
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("lockNextBtn").click();
    }
  };

  document.getElementById("lockNextBtn").onclick = async () => {
    const secret = input.value; // not trimmed: a password may contain spaces
    if (!validSecret(chosenType, secret)) {
      renderSetup(step, firstSecret, invalidMessage(chosenType));
      return;
    }
    if (!isConfirm) {
      renderSetup("confirm", secret);
      return;
    }
    if (secret !== firstSecret) {
      renderSetup("new", undefined, "Those two didn't match — start again.");
      return;
    }
    await setPin(secret, chosenType);
    offerBiometric();
  };
}

async function offerBiometric() {
  const available = await biometricAvailable().catch(() => false);
  if (!available) {
    closeModal();
    onChange();
    return;
  }
  openModal(
    `
    <div class="grabber"></div>
    <h3>Use Face ID / Touch ID too?</h3>
    <p class="auth-message">Unlock faster with your face or fingerprint — your passcode still works as a backup, and is required if biometrics ever fail.</p>
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-primary" id="lockEnableBiometricBtn">Turn it on</button>
      <button class="btn btn-ghost" id="lockSkipBiometricBtn">Not now</button>
    </div>
  `,
    () => {
      closeModal();
      onChange();
    },
  );
  document.getElementById("lockSkipBiometricBtn").onclick = () => {
    closeModal();
    onChange();
  };
  document.getElementById("lockEnableBiometricBtn").onclick = async () => {
    try {
      await enrollBiometric();
    } catch (e) {
      // Cancelled or unsupported mid-flow — the passcode alone is still fully set up either way.
    }
    closeModal();
    onChange();
  };
}

function renderManage(message) {
  const biometricOn = hasBiometricEnrolled();
  const type = getLockType();
  const noun = lockTypeLabel(type);
  openModal(`
    <div class="grabber"></div>
    <h3>App Lock</h3>
    <p class="auth-message">A ${escapeHtml(noun)} is required to open Kwenta on this device${biometricOn ? ", with Face ID / Touch ID as a shortcut" : ""}.</p>
    ${
      type === "pin-legacy"
        ? `<p class="auth-message">Your PIN was made before 4-digit, 6-digit and password options existed, so it unlocks with an Unlock button. Change it to pick a type and unlock automatically.</p>`
        : ""
    }
    ${message ? `<p class="auth-message" style="color:var(--coral);">${escapeHtml(message)}</p>` : ""}
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-ghost" id="lockChangePinBtn">Change passcode</button>
      <button class="btn btn-ghost" id="lockToggleBiometricBtn">${biometricOn ? "Turn off Face ID / Touch ID" : "Turn on Face ID / Touch ID"}</button>
      <button class="btn btn-ghost" id="lockCloseBtn">Close</button>
      <button class="btn btn-danger" id="lockTurnOffBtn">Turn off App Lock</button>
    </div>
  `);

  document.getElementById("lockCloseBtn").onclick = closeModal;
  document.getElementById("lockChangePinBtn").onclick = () => {
    chosenType = type === "pin-legacy" ? "pin4" : type;
    renderSetup("new");
  };

  document.getElementById("lockToggleBiometricBtn").onclick = async () => {
    if (biometricOn) {
      disableBiometric();
      renderManage();
      return;
    }
    const available = await biometricAvailable().catch(() => false);
    if (!available) {
      renderManage(
        "This device doesn't support Face ID / Touch ID in this browser.",
      );
      return;
    }
    try {
      await enrollBiometric();
    } catch (e) {
      renderManage("Setup was cancelled.");
      return;
    }
    renderManage();
  };

  document.getElementById("lockTurnOffBtn").onclick = () => confirmTurnOff();
}

// Turning the lock off is gated behind the account password, same pattern as
// disabling 2FA (mfaSetupSheet.js) — for anyone signed in. Guest/local-only
// users have no account password to check, so it's a plain confirmation
// instead; this lock was never protecting their cloud data to begin with.
function confirmTurnOff() {
  const doTurnOff = () => {
    clearLock();
    closeModal();
    onChange();
  };

  if (getCurrentUser()) {
    requirePasswordConfirmation(doTurnOff, {
      title: "Confirm your password",
      message:
        "Turning off App Lock removes the passcode requirement on this device — confirm it's really you.",
    });
  } else {
    openModal(`
      <div class="grabber"></div>
      <h3>Turn off App Lock?</h3>
      <p class="auth-message">Kwenta will open without a passcode on this device from now on.</p>
      <div class="sheet-actions">
        <button class="btn btn-ghost" id="lockKeepBtn">Keep it on</button>
        <button class="btn btn-danger" id="lockConfirmOffBtn">Turn off</button>
      </div>
    `);
    document.getElementById("lockKeepBtn").onclick = () => renderManage();
    document.getElementById("lockConfirmOffBtn").onclick = doTurnOff;
  }
}
