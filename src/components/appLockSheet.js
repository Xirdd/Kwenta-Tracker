import { openModal, closeModal } from "./modal.js";
import { requirePasswordConfirmation } from "./reauthSheet.js";
import { getCurrentUser } from "../auth.js";
import {
  isLockEnabled,
  setPin,
  clearLock,
  biometricAvailable,
  hasBiometricEnrolled,
  enrollBiometric,
  disableBiometric,
} from "../appLock.js";

let onChange = () => {};

export function initAppLockSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openAppLockSheet() {
  isLockEnabled() ? renderManage() : renderSetup();
}

function renderSetup(step = "new", firstPin, error) {
  const isConfirm = step === "confirm";
  openModal(`
    <div class="grabber"></div>
    <h3>${isConfirm ? "Confirm your PIN" : "Set a PIN"}</h3>
    <p class="auth-message">${isConfirm ? "Enter it once more to confirm." : "4–6 digits. This stays on this device only — it isn't part of your account."}</p>
    <div class="field">
      <label>PIN</label>
      <input id="lockPinInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••" class="mfa-code-input"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="lockCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="lockNextBtn">${isConfirm ? "Confirm" : "Next"}</button>
    </div>
  `);

  const input = document.getElementById("lockPinInput");
  input.focus();
  document.getElementById("lockCancelBtn").onclick = closeModal;

  document.getElementById("lockNextBtn").onclick = async () => {
    const pin = input.value.trim();
    if (!/^\d{4,6}$/.test(pin)) {
      renderSetup(step, firstPin, "PIN needs to be 4–6 digits.");
      return;
    }
    if (!isConfirm) {
      renderSetup("confirm", pin);
      return;
    }
    if (pin !== firstPin) {
      renderSetup("new", undefined, "Those two didn't match — start again.");
      return;
    }
    await setPin(pin);
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
    <p class="auth-message">Unlock faster with your face or fingerprint — your PIN still works as a backup, and is required if biometrics ever fail.</p>
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-primary" id="lockEnableBiometricBtn">Turn it on</button>
      <button class="btn btn-ghost" id="lockSkipBiometricBtn">Not now</button>
    </div>
  `,
    () => {
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
      // Cancelled or unsupported mid-flow — the PIN alone is still fully set up either way.
    }
    closeModal();
    onChange();
  };
}

function renderManage(message) {
  const biometricOn = hasBiometricEnrolled();
  openModal(`
    <div class="grabber"></div>
    <h3>App Lock</h3>
    <p class="auth-message">A PIN is required to open Kwenta on this device${biometricOn ? ", with Face ID / Touch ID as a shortcut" : ""}.</p>
    ${message ? `<p class="auth-message" style="color:var(--coral);">${message}</p>` : ""}
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-ghost" id="lockChangePinBtn">Change PIN</button>
      <button class="btn btn-ghost" id="lockToggleBiometricBtn">${biometricOn ? "Turn off Face ID / Touch ID" : "Turn on Face ID / Touch ID"}</button>
      <button class="btn btn-ghost" id="lockCloseBtn">Close</button>
      <button class="btn btn-danger" id="lockTurnOffBtn">Turn off App Lock</button>
    </div>
  `);

  document.getElementById("lockCloseBtn").onclick = closeModal;
  document.getElementById("lockChangePinBtn").onclick = () =>
    renderSetup("new");

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
        "Turning off App Lock removes the PIN requirement on this device — confirm it's really you.",
    });
  } else {
    openModal(`
      <div class="grabber"></div>
      <h3>Turn off App Lock?</h3>
      <p class="auth-message">Kwenta will open without a PIN on this device from now on.</p>
      <div class="sheet-actions">
        <button class="btn btn-ghost" id="lockKeepBtn">Keep it on</button>
        <button class="btn btn-danger" id="lockConfirmOffBtn">Turn off</button>
      </div>
    `);
    document.getElementById("lockKeepBtn").onclick = () => renderManage();
    document.getElementById("lockConfirmOffBtn").onclick = doTurnOff;
  }
}
