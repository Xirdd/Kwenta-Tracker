// A local, device-only PIN gate on opening the app — separate from your
// Supabase sign-in. The PIN never leaves this device and isn't synced.
//
// What changed in the hardening pass:
//  - The PIN is stored as a salted PBKDF2 hash (150k iterations) instead of a
//    single SHA-256, so guessing offline from a copy of localStorage is far
//    slower. Old SHA-256 hashes still verify and are upgraded on first unlock.
//  - Wrong PINs are counted: 5 in a row locks the keypad with a growing
//    delay (30s, 1m, 2m, 4m, 8m), and the 10th signs the account out
//    entirely so the real password is needed again.
//  - "Forgot PIN?" now needs the account password (checked on the server,
//    which also throttles it) instead of a single confirm() dialog.
//
// Honest limit: this is still a client-side convenience lock. The counters
// live in localStorage, so someone with devtools access to an unlocked
// browser profile could reset them. Your real data is protected by Supabase
// auth + RLS (+ 2FA) regardless of whether this is on.
//
// The lock belongs to a SIGNED-IN session. It only appears while someone is
// signed in (see canLock), and logging out wipes it (resetAppLock).
import "./appLock.css";
import { verifyCurrentPassword, signOut } from "./auth.js";

const PIN_HASH_KEY = "kwenta_lock_pin_hash";
const PIN_SALT_KEY = "kwenta_lock_pin_salt";
const LOCK_ENABLED_KEY = "kwenta_lock_enabled";
const BIOMETRIC_CRED_KEY = "kwenta_lock_biometric_cred_id";
const FAIL_COUNT_KEY = "kwenta_lock_fail_count";
const LOCKED_UNTIL_KEY = "kwenta_lock_locked_until";

const PBKDF2_ITERATIONS = 150000;
const FREE_ATTEMPTS = 5; // wrong PINs allowed before delays start
const SIGN_OUT_AT = 10; // total wrong attempts before a forced sign-out
const BASE_DELAY_MS = 30 * 1000;

// Re-lock after this long in the background (switching apps, screen off).
const AWAY_LOCK_MS = 2 * 60 * 1000;

let hiddenAt = null;
let overlayEl = null;
let countdownTimer = null;
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
async function hashPinV2(pin, saltHex, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
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
async function hashPinLegacy(pin, saltHex) {
  const data = new TextEncoder().encode(saltHex + ":" + pin);
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}

export function isLockEnabled() {
  return (
    localStorage.getItem(LOCK_ENABLED_KEY) === "1" &&
    !!localStorage.getItem(PIN_HASH_KEY)
  );
}

export async function setPin(pin) {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await hashPinV2(pin, salt);
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(LOCK_ENABLED_KEY, "1");
  clearFailures();
}

export async function verifyPin(pin) {
  const salt = localStorage.getItem(PIN_SALT_KEY);
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!salt || !stored) return false;

  if (stored.startsWith("v2$")) {
    const iterations = Number(stored.split("$")[1]) || PBKDF2_ITERATIONS;
    return safeEqual(await hashPinV2(pin, salt, iterations), stored);
  }

  // Legacy SHA-256 hash: verify, then upgrade it in place.
  const ok = safeEqual(await hashPinLegacy(pin, salt), stored);
  if (ok) {
    try {
      localStorage.setItem(PIN_HASH_KEY, await hashPinV2(pin, salt));
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

// Records one wrong PIN / wrong password. Returns { signOut } when the limit
// for a forced sign-out is reached.
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
  clearInterval(countdownTimer);
  try {
    await signOut(); // main.js's auth listener wipes the lock via resetAppLock()
  } catch (e) {
    /* fall through — resetAppLock below still removes the lock screen */
  }
  resetAppLock();
}

// Turns the lock off entirely or is called by the "Forgot PIN" reset flow.
export function clearLock() {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(LOCK_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CRED_KEY);
  clearFailures();
}

// Called on logout (and whenever a session ends). Wipes every trace of the
// lock and takes down the lock screen if it's currently showing.
export function resetAppLock() {
  clearInterval(countdownTimer);
  clearLock();
  hiddenAt = null;
  if (overlayEl) {
    overlayEl.classList.remove("show");
    overlayEl.innerHTML = "";
  }
}

// ── Optional Face ID / Touch ID ──────────────────────────────────────────
// A LOCAL convenience gate, not a server-verified factor. If it's ever
// unsupported or fails, the PIN is always the fallback. Biometric attempts
// don't count toward the PIN attempt limit.
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

function renderLockScreen(error) {
  clearInterval(countdownTimer);
  const el = ensureOverlay();
  const waitMs = lockedUntil() - Date.now();
  const isLockedOut = waitMs > 0;

  el.innerHTML = `
    <div class="lock-card">
      <div class="lock-peso">₱</div>
      <h2>Kwenta is locked</h2>
      <p class="lock-sub" id="lockSub">${
        isLockedOut
          ? `Too many wrong PINs. Try again in ${formatWait(waitMs)}.`
          : error || "Enter your PIN to continue."
      }</p>
      <div class="lock-dots" id="lockDots"></div>
      <div class="lock-keypad" id="lockKeypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-key="${n}" ${isLockedOut ? "disabled" : ""}>${n}</button>`).join("")}
        <button type="button" id="lockBiometricBtn" style="visibility:hidden;">🔓</button>
        <button type="button" data-key="0" ${isLockedOut ? "disabled" : ""}>0</button>
        <button type="button" id="lockBackspaceBtn" ${isLockedOut ? "disabled" : ""}>⌫</button>
      </div>
      <button type="button" class="delete-account-link" id="lockForgotBtn">Forgot PIN?</button>
    </div>`;
  el.classList.add("show");

  let entered = "";
  const dotsEl = document.getElementById("lockDots");
  const renderDots = () => {
    dotsEl.innerHTML = Array.from({ length: 6 })
      .map(
        (_, i) => `<span class="${i < entered.length ? "filled" : ""}"></span>`,
      )
      .join("");
  };
  renderDots();

  if (isLockedOut) {
    countdownTimer = setInterval(() => {
      const left = lockedUntil() - Date.now();
      if (left <= 0) {
        renderLockScreen(); // keypad comes back
        return;
      }
      const sub = document.getElementById("lockSub");
      if (sub)
        sub.textContent = `Too many wrong PINs. Try again in ${formatWait(left)}.`;
    }, 1000);
  }

  let verifying = false;
  async function submit() {
    if (verifying) return;
    verifying = true;
    const ok = await verifyPin(entered);
    verifying = false;
    if (ok) {
      clearFailures();
      unlock();
      return;
    }
    const result = registerFailure();
    if (result.signOut) {
      await forceSignOut();
      return;
    }
    renderLockScreen(
      failCount() >= FREE_ATTEMPTS
        ? undefined // the lockout message takes over
        : `That PIN didn't match — ${FREE_ATTEMPTS - failCount()} ${FREE_ATTEMPTS - failCount() === 1 ? "try" : "tries"} left before a delay.`,
    );
  }

  document.querySelectorAll("#lockKeypad [data-key]").forEach((btn) => {
    btn.onclick = () => {
      if (isLockedOut || entered.length >= 6) return;
      entered += btn.dataset.key;
      renderDots();
      if (entered.length >= 4) submit();
    };
  });
  document.getElementById("lockBackspaceBtn").onclick = () => {
    entered = entered.slice(0, -1);
    renderDots();
  };
  document.getElementById("lockForgotBtn").onclick = () => renderForgotScreen();

  if (hasBiometricEnrolled() && !isLockedOut) {
    const bBtn = document.getElementById("lockBiometricBtn");
    bBtn.style.visibility = "visible";
    bBtn.onclick = attemptBiometric;
    attemptBiometric();
  }

  async function attemptBiometric() {
    if (await tryBiometricUnlock()) {
      clearFailures();
      unlock();
    }
  }
}

// "Forgot PIN" → prove it's really the account owner with the account
// password, then the PIN lock is removed (they can set a new one in Profile).
// Checked on the server, which throttles wrong guesses itself; each wrong
// guess here also counts toward the forced sign-out limit.
function renderForgotScreen(error) {
  clearInterval(countdownTimer);
  const el = ensureOverlay();
  el.innerHTML = `
    <div class="lock-card" style="text-align:left;">
      <div class="lock-peso" style="margin-left:auto;margin-right:auto;">₱</div>
      <h2 style="text-align:center;">Reset your PIN</h2>
      <p class="lock-sub" style="text-align:center;">Enter your account password. This removes the PIN lock on this device — you can set a new one in Profile.</p>
      <div class="field">
        <label for="lockForgotPassword">Account password</label>
        <input id="lockForgotPassword" type="password" autocomplete="current-password" placeholder="Your password"/>
      </div>
      ${error ? `<p class="lock-sub" style="color:var(--coral);text-align:center;" id="lockForgotError"></p>` : ""}
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" id="lockForgotBackBtn">Back</button>
        <button type="button" class="btn btn-primary" id="lockForgotConfirmBtn">Reset PIN</button>
      </div>
    </div>`;
  el.classList.add("show");
  // textContent, never innerHTML: the message can contain server text.
  if (error) document.getElementById("lockForgotError").textContent = error;

  document.getElementById("lockForgotBackBtn").onclick = () =>
    renderLockScreen();

  document.getElementById("lockForgotConfirmBtn").onclick = async () => {
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
  clearInterval(countdownTimer);
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
