// A local, device-only passcode gate on opening the app — separate from your
// Supabase sign-in. The passcode never leaves this device and isn't synced.
//
// Passcode types (chosen when it's created — see components/appLockSheet.js):
//   "pin4"     a 4-digit PIN   — unlocks automatically on the 4th digit
//   "pin6"     a 6-digit PIN   — unlocks automatically on the 6th digit
//   "password" letters/numbers/symbols (6+ characters) — typed, then Unlock
//   "pin-legacy"  a PIN made BEFORE types existed (4–6 digits, length unknown).
//              The old screen drew 6 dots but tried to unlock after 4 digits,
//              so a 6-digit PIN could never work. These keep their PIN but
//              unlock with an explicit Unlock button instead of guessing; the
//              next time it's changed it becomes a proper typed passcode.
//
// Hardening carried over from before:
//  - Salted PBKDF2 hash (150k iterations); old SHA-256 hashes still verify and
//    are upgraded on first unlock.
//  - Wrong attempts are counted: 5 in a row locks the keypad with a growing
//    delay (30s, 1m, 2m, 4m, 8m), and the 10th signs the account out entirely.
//  - "Forgot passcode?" needs the account password (checked on the server).
//
// Honest limit: this is still a client-side convenience lock. The counters live
// in localStorage, so someone with devtools access to an unlocked browser
// profile could reset them. Your real data is protected by Supabase auth + RLS
// (+ 2FA) regardless of whether this is on.
//
// The lock belongs to a SIGNED-IN session. It only appears while someone is
// signed in (see canLock), and logging out wipes it (resetAppLock).
import "./appLock.css";
import { verifyCurrentPassword, signOut } from "./auth.js";

const PIN_HASH_KEY = "kwenta_lock_pin_hash";
const PIN_SALT_KEY = "kwenta_lock_pin_salt";
const LOCK_ENABLED_KEY = "kwenta_lock_enabled";
const LOCK_TYPE_KEY = "kwenta_lock_type";
const BIOMETRIC_CRED_KEY = "kwenta_lock_biometric_cred_id";
const FAIL_COUNT_KEY = "kwenta_lock_fail_count";
const LOCKED_UNTIL_KEY = "kwenta_lock_locked_until";

const PBKDF2_ITERATIONS = 150000;
const FREE_ATTEMPTS = 5; // wrong attempts allowed before delays start
const SIGN_OUT_AT = 10; // total wrong attempts before a forced sign-out
const BASE_DELAY_MS = 30 * 1000;

// Re-lock after this long in the background (switching apps, screen off).
const AWAY_LOCK_MS = 2 * 60 * 1000;

// The choices offered when creating a passcode (used by appLockSheet.js).
export const LOCK_TYPES = [
  { id: "pin4", label: "4-digit PIN", short: "4-digit PIN", length: 4 },
  { id: "pin6", label: "6-digit PIN", short: "6-digit PIN", length: 6 },
  { id: "password", label: "Password", short: "password", length: 0 },
];
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 64;

let hiddenAt = null;
let overlayEl = null;
let countdownTimer = null;
let keyHandler = null;
let onUnlockedCallback = () => {};
let canLock = () => true; // supplied by main.js: "is someone signed in?"

function bytesToHex(buf) {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Hashing ──────────────────────────────────────────────────────────────
async function hashSecretV2(secret, saltHex, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(saltHex), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return `v2$${iterations}$${bytesToHex(bits)}`;
}

// The original format, kept only so existing PINs keep working until their
// next successful unlock re-hashes them as v2.
async function hashSecretLegacy(secret, saltHex) {
  const data = new TextEncoder().encode(saltHex + ":" + secret);
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}

export function isLockEnabled() {
  return (
    localStorage.getItem(LOCK_ENABLED_KEY) === "1" &&
    !!localStorage.getItem(PIN_HASH_KEY)
  );
}

// "pin4" | "pin6" | "password" | "pin-legacy"
export function getLockType() {
  const t = localStorage.getItem(LOCK_TYPE_KEY);
  return t === "pin4" || t === "pin6" || t === "password" ? t : "pin-legacy";
}

// Words for messages: "4-digit PIN", "6-digit PIN", "password", "PIN".
export function lockTypeLabel(type = getLockType()) {
  const found = LOCK_TYPES.find((t) => t.id === type);
  return found ? found.short : "PIN";
}

// `secret` is the digits or the password; `type` is one of LOCK_TYPES' ids.
// The caller (appLockSheet.js) validates length/format before calling this.
export async function setPin(secret, type = "pin4") {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await hashSecretV2(secret, salt);
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(LOCK_TYPE_KEY, type);
  localStorage.setItem(LOCK_ENABLED_KEY, "1");
  clearFailures();
}

export async function verifyPin(secret) {
  const salt = localStorage.getItem(PIN_SALT_KEY);
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!salt || !stored) return false;

  if (stored.startsWith("v2$")) {
    const iterations = Number(stored.split("$")[1]) || PBKDF2_ITERATIONS;
    return safeEqual(await hashSecretV2(secret, salt, iterations), stored);
  }

  // Legacy SHA-256 hash: verify, then upgrade it in place.
  const ok = safeEqual(await hashSecretLegacy(secret, salt), stored);
  if (ok) {
    try {
      localStorage.setItem(PIN_HASH_KEY, await hashSecretV2(secret, salt));
    } catch (e) {
      /* keep the legacy hash; it still works */
    }
  }
  return ok;
}

// ── Attempt limiting ─────────────────────────────────────────────────────
function failCount() {
  return Number(localStorage.getItem(FAIL_COUNT_KEY)) || 0;
}

function lockedUntil() {
  return Number(localStorage.getItem(LOCKED_UNTIL_KEY)) || 0;
}

function clearFailures() {
  localStorage.removeItem(FAIL_COUNT_KEY);
  localStorage.removeItem(LOCKED_UNTIL_KEY);
}

// Records one wrong passcode / wrong account password. Returns { signOut }
// when the limit for a forced sign-out is reached.
function registerFailure() {
  const n = failCount() + 1;
  localStorage.setItem(FAIL_COUNT_KEY, String(n));
  if (n >= SIGN_OUT_AT) return { signOut: true };
  if (n >= FREE_ATTEMPTS) {
    const delay = BASE_DELAY_MS * 2 ** (n - FREE_ATTEMPTS);
    localStorage.setItem(LOCKED_UNTIL_KEY, String(Date.now() + delay));
  }
  return { signOut: false };
}

function formatWait(ms) {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s}s`;
}

async function forceSignOut() {
  stopTimersAndKeys();
  try {
    await signOut(); // main.js's auth listener wipes the lock via resetAppLock()
  } catch (e) {
    /* fall through — resetAppLock below still removes the lock screen */
  }
  resetAppLock();
}

// Turns the lock off entirely or is called by the "Forgot passcode" reset flow.
export function clearLock() {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(LOCK_ENABLED_KEY);
  localStorage.removeItem(LOCK_TYPE_KEY);
  localStorage.removeItem(BIOMETRIC_CRED_KEY);
  clearFailures();
}

// Called on logout (and whenever a session ends). Wipes every trace of the
// lock and takes down the lock screen if it's currently showing.
export function resetAppLock() {
  stopTimersAndKeys();
  clearLock();
  hiddenAt = null;
  if (overlayEl) {
    overlayEl.classList.remove("show");
    overlayEl.innerHTML = "";
  }
}

function stopTimersAndKeys() {
  clearInterval(countdownTimer);
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
}

// ── Optional Face ID / Touch ID ──────────────────────────────────────────
// A LOCAL convenience gate, not a server-verified factor. If it's ever
// unsupported or fails, the passcode is always the fallback. Biometric
// attempts don't count toward the attempt limit.
export async function biometricAvailable() {
  return !!(
    window.PublicKeyCredential &&
    (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(
      () => false,
    ))
  );
}

export function hasBiometricEnrolled() {
  return !!localStorage.getItem(BIOMETRIC_CRED_KEY);
}

export async function enrollBiometric() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Kwenta" },
      user: { id: userId, name: "kwenta-local", displayName: "Kwenta" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 30000,
    },
  });
  if (!cred) throw new Error("Setup was cancelled.");
  localStorage.setItem(BIOMETRIC_CRED_KEY, bytesToHex(cred.rawId));
}

export function disableBiometric() {
  localStorage.removeItem(BIOMETRIC_CRED_KEY);
}

async function tryBiometricUnlock() {
  const idHex = localStorage.getItem(BIOMETRIC_CRED_KEY);
  if (!idHex) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const idBytes = new Uint8Array(
      idHex.match(/.{2}/g).map((h) => parseInt(h, 16)),
    );
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: idBytes, type: "public-key" }],
        userVerification: "required",
        timeout: 30000,
      },
    });
    return !!assertion;
  } catch (e) {
    return false;
  }
}

// ── The lock screen itself ───────────────────────────────────────────────
const FACE_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1"/><path d="M15 10v1"/><path d="M12 10v3h-1"/><path d="M9 16c.8.7 1.8 1 3 1s2.2-.3 3-1"/></svg>`;
const BACKSPACE_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m16 9-4 6"/><path d="m12 9 4 6"/></svg>`;

function ensureOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement("div");
  overlayEl.id = "appLockOverlay";
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  overlayEl.setAttribute("aria-label", "Kwenta is locked");
  document.body.appendChild(overlayEl);
  return overlayEl;
}

function haptic() {
  try {
    if (navigator.vibrate) navigator.vibrate(6); // Android; iOS ignores it
  } catch (e) {
    /* ignore */
  }
}

function renderLockScreen(error, { shake = false } = {}) {
  stopTimersAndKeys();
  const el = ensureOverlay();
  const type = getLockType();
  const isPassword = type === "password";
  const isLegacy = type === "pin-legacy";
  // How many digits unlock automatically: exactly the PIN's own length.
  // 0 means "never automatically" (password, legacy).
  const autoLength = type === "pin4" ? 4 : type === "pin6" ? 6 : 0;
  const maxDigits = autoLength || 6;
  const noun = isPassword ? "password" : "PIN";

  const waitMs = lockedUntil() - Date.now();
  const isLockedOut = waitMs > 0;
  const subText = isLockedOut
    ? `Too many wrong attempts. Try again in ${formatWait(waitMs)}.`
    : error ||
      (isPassword
        ? "Enter your password to continue."
        : "Enter your PIN to continue.");

  const head = `
    <div class="lock-head">
      <div class="lock-peso" aria-hidden="true">₱</div>
      <h2>Kwenta is locked</h2>
      <p class="lock-sub ${error && !isLockedOut ? "error" : ""}" id="lockSub" role="status" aria-live="polite">${subText}</p>
    </div>`;

  const foot = `
    <button type="button" class="lock-link" id="lockForgotBtn">Forgot ${isPassword ? "password" : "PIN"}?</button>`;

  if (isPassword) {
    el.innerHTML = `
    <div class="lock-screen">
      ${head}
      <form class="lock-form" id="lockForm" novalidate>
        <input id="lockPassword" class="lock-input ${shake ? "shake" : ""}" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Password" aria-label="Password" ${isLockedOut ? "disabled" : ""}/>
        <button type="submit" class="lock-unlock" id="lockUnlockBtn" ${isLockedOut ? "disabled" : ""}>Unlock</button>
      </form>
      <button type="button" class="lock-link lock-bio-link" id="lockBiometricBtn" hidden>Use Face ID / Touch ID</button>
      ${foot}
    </div>`;
  } else {
    el.innerHTML = `
    <div class="lock-screen">
      ${head}
      <div class="lock-dots ${shake ? "shake" : ""}" id="lockDots" role="img"></div>
      <div class="lock-keypad" id="lockKeypad" role="group" aria-label="Keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map(
            (n) =>
              `<button type="button" class="lock-key" data-key="${n}" ${isLockedOut ? "disabled" : ""}>${n}</button>`,
          )
          .join("")}
        <button type="button" class="lock-key lock-key-ghost" id="lockBiometricBtn" aria-label="Use Face ID or Touch ID" style="visibility:hidden;">${FACE_ICON}</button>
        <button type="button" class="lock-key" data-key="0" ${isLockedOut ? "disabled" : ""}>0</button>
        <button type="button" class="lock-key lock-key-ghost" id="lockBackspaceBtn" aria-label="Delete" ${isLockedOut ? "disabled" : ""}>${BACKSPACE_ICON}</button>
      </div>
      ${isLegacy ? `<button type="button" class="lock-unlock" id="lockUnlockBtn" ${isLockedOut ? "disabled" : ""}>Unlock</button>` : ""}
      ${foot}
    </div>`;
  }
  el.classList.add("show");

  // Counts down a lockout, then redraws with the keypad enabled again.
  if (isLockedOut) {
    countdownTimer = setInterval(() => {
      const left = lockedUntil() - Date.now();
      if (left <= 0) {
        renderLockScreen();
        return;
      }
      const sub = document.getElementById("lockSub");
      if (sub)
        sub.textContent = `Too many wrong attempts. Try again in ${formatWait(left)}.`;
    }, 1000);
  }

  let verifying = false;
  async function submit(value) {
    if (verifying || isLockedOut || !value) return;
    verifying = true;
    const ok = await verifyPin(value);
    verifying = false;
    if (ok) {
      clearFailures();
      unlock();
      return;
    }
    if (registerFailure().signOut) {
      await forceSignOut();
      return;
    }
    const remaining = FREE_ATTEMPTS - failCount();
    renderLockScreen(
      failCount() >= FREE_ATTEMPTS
        ? undefined // the lockout message takes over
        : `Wrong ${noun} — ${remaining} ${remaining === 1 ? "try" : "tries"} left before a delay.`,
      { shake: true },
    );
  }

  if (isPassword) {
    const input = document.getElementById("lockPassword");
    document.getElementById("lockForm").onsubmit = (ev) => {
      ev.preventDefault();
      submit(input.value);
    };
    if (!isLockedOut) input.focus();
  } else {
    let entered = "";
    const dotsEl = document.getElementById("lockDots");
    const renderDots = () => {
      dotsEl.innerHTML = Array.from({ length: maxDigits })
        .map(
          (_, i) =>
            `<span class="${i < entered.length ? "filled" : ""}"></span>`,
        )
        .join("");
      dotsEl.setAttribute(
        "aria-label",
        `${entered.length} of ${maxDigits} digits entered`,
      );
    };
    renderDots();

    const press = (digit) => {
      if (isLockedOut || verifying || entered.length >= maxDigits) return;
      entered += digit;
      renderDots();
      haptic();
      // Unlock automatically only when EXACTLY the PIN's own length has been
      // typed — never earlier (the old screen tried after 4 digits even though
      // it showed 6 slots).
      if (autoLength && entered.length === autoLength) submit(entered);
    };
    const backspace = () => {
      if (isLockedOut || verifying) return;
      entered = entered.slice(0, -1);
      renderDots();
    };

    document.querySelectorAll("#lockKeypad [data-key]").forEach((btn) => {
      btn.onclick = () => press(btn.dataset.key);
    });
    document.getElementById("lockBackspaceBtn").onclick = backspace;

    const unlockBtn = document.getElementById("lockUnlockBtn"); // legacy PINs only
    if (unlockBtn) {
      unlockBtn.onclick = () => {
        if (entered.length >= 4) submit(entered);
      };
    }

    // Hardware keyboard (desktop / iPad): digits, Backspace, Enter (legacy).
    keyHandler = (ev) => {
      if (ev.key.length === 1 && ev.key >= "0" && ev.key <= "9") press(ev.key);
      else if (ev.key === "Backspace") backspace();
      else if (ev.key === "Enter" && unlockBtn && entered.length >= 4)
        submit(entered);
    };
    document.addEventListener("keydown", keyHandler);
  }

  document.getElementById("lockForgotBtn").onclick = () => renderForgotScreen();

  // Offer Face ID / Touch ID — but not straight after a wrong attempt, where
  // a second system prompt popping up on top of the error would be annoying.
  if (hasBiometricEnrolled() && !isLockedOut) {
    const bBtn = document.getElementById("lockBiometricBtn");
    bBtn.hidden = false;
    bBtn.style.visibility = "visible";
    bBtn.onclick = attemptBiometric;
    if (!error && !shake) attemptBiometric();
  }

  async function attemptBiometric() {
    if (await tryBiometricUnlock()) {
      clearFailures();
      unlock();
    }
  }
}

// "Forgot passcode" → prove it's really the account owner with the account
// password, then the passcode lock is removed (a new one can be set in
// Profile). Checked on the server, which throttles wrong guesses itself; each
// wrong guess here also counts toward the forced sign-out limit.
function renderForgotScreen(error) {
  stopTimersAndKeys();
  const el = ensureOverlay();
  const noun = getLockType() === "password" ? "password" : "PIN";
  el.innerHTML = `
    <div class="lock-screen lock-screen-form">
      <div class="lock-head">
        <div class="lock-peso" aria-hidden="true">₱</div>
        <h2>Reset your ${noun}</h2>
        <p class="lock-sub">Enter your <strong>account</strong> password. This removes the lock on this device — you can set a new one in Settings.</p>
      </div>
      <form class="lock-form" id="lockForgotForm" novalidate>
        <input id="lockForgotPassword" class="lock-input" type="password" autocomplete="current-password" placeholder="Account password" aria-label="Account password"/>
        <p class="lock-sub error" id="lockForgotError" role="alert" ${error ? "" : "hidden"}></p>
        <div class="lock-row">
          <button type="button" class="lock-secondary" id="lockForgotBackBtn">Back</button>
          <button type="submit" class="lock-unlock" id="lockForgotConfirmBtn">Reset ${noun}</button>
        </div>
      </form>
    </div>`;
  el.classList.add("show");
  // textContent, never innerHTML: the message can contain server text.
  if (error) document.getElementById("lockForgotError").textContent = error;

  document.getElementById("lockForgotPassword").focus();
  document.getElementById("lockForgotBackBtn").onclick = () =>
    renderLockScreen();

  document.getElementById("lockForgotForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const pw = document.getElementById("lockForgotPassword").value;
    if (!pw) {
      renderForgotScreen("Enter your password.");
      return;
    }
    const btn = document.getElementById("lockForgotConfirmBtn");
    btn.disabled = true;
    btn.textContent = "Checking…";
    try {
      const ok = await verifyCurrentPassword(pw);
      if (ok) {
        clearLock(); // also clears the failure counters
        unlock();
        return;
      }
      if (registerFailure().signOut) {
        await forceSignOut();
        return;
      }
      renderForgotScreen("That password didn't match.");
    } catch (e) {
      renderForgotScreen(e.message || "Couldn't check your password.");
    }
  };
}

function unlock() {
  stopTimersAndKeys();
  if (overlayEl) overlayEl.classList.remove("show");
  onUnlockedCallback();
}

function showLockIfNeeded() {
  if (!canLock() || !isLockEnabled()) return;
  renderLockScreen();
}

export function initAppLock(onUnlocked = () => {}, isSignedIn = () => true) {
  onUnlockedCallback = onUnlocked;
  canLock = isSignedIn;
  showLockIfNeeded();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > AWAY_LOCK_MS) {
      showLockIfNeeded();
    }
  });
}
