// A local, device-only PIN gate on opening the app — separate from your
// Supabase sign-in. The PIN never leaves this device and isn't synced, same
// as theme.js/currency.js's own per-device settings: it's stored as a salted
// SHA-256 hash in localStorage (via the Web Crypto API, not a plaintext
// comparison), so nothing readable sits in localStorage even if someone
// inspects it.
//
import "./appLock.css";

// This is a convenience lock, not a replacement for your account password —
// your real data is protected by Supabase auth + RLS regardless of whether
// this is on. Treat "forgot PIN" accordingly (see resetLock() below): it
// clears the local lock, it does not touch your account or your data.

const PIN_HASH_KEY = "kwenta_lock_pin_hash";
const PIN_SALT_KEY = "kwenta_lock_pin_salt";
const LOCK_ENABLED_KEY = "kwenta_lock_enabled";
const BIOMETRIC_CRED_KEY = "kwenta_lock_biometric_cred_id";

// Re-lock after this long in the background (switching apps, screen off).
// Short-lived tab switches (checking a text message) don't re-trigger it.
const AWAY_LOCK_MS = 2 * 60 * 1000;

let hiddenAt = null;
let overlayEl = null;
let onUnlockedCallback = () => {};

function bytesToHex(buf) {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin, saltHex) {
  const enc = new TextEncoder();
  const data = enc.encode(saltHex + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
}

export function isLockEnabled() {
  return (
    localStorage.getItem(LOCK_ENABLED_KEY) === "1" &&
    !!localStorage.getItem(PIN_HASH_KEY)
  );
}

export async function setPin(pin) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToHex(saltBytes.buffer);
  const hash = await hashPin(pin, salt);
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(LOCK_ENABLED_KEY, "1");
}

export async function verifyPin(pin) {
  const salt = localStorage.getItem(PIN_SALT_KEY);
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!salt || !stored) return false;
  const attempt = await hashPin(pin, salt);
  return attempt === stored;
}

// Turns the lock off entirely (Profile → App Lock → Turn off, after
// confirming the current PIN) or is called by the "Forgot PIN" reset flow.
export function clearLock() {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(LOCK_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CRED_KEY);
}

// ── Optional Face ID / Touch ID ──────────────────────────────────────────
// Progressive enhancement only: if the platform has a biometric
// authenticator, this registers a WebAuthn credential and remembers its id.
// A successful navigator.credentials.get() on that id is treated as proof
// the OS verified the person's face/fingerprint. This is a LOCAL convenience
// gate, not a server-verified factor — Kwenta has no auth server backing
// this credential, unlike Supabase's own sign-in. If it's ever unsupported
// or fails, the PIN is always the fallback, so nobody can be locked out by a
// browser that doesn't support this.
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
    return false; // cancelled, or the sensor failed — fall back to the PIN silently
  }
}

// ── The lock screen itself ───────────────────────────────────────────────
function ensureOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement("div");
  overlayEl.id = "appLockOverlay";
  document.body.appendChild(overlayEl);
  return overlayEl;
}

function renderLockScreen(error) {
  const el = ensureOverlay();
  el.innerHTML = `
    <div class="lock-card">
      <div class="lock-peso">₱</div>
      <h2>Kwenta is locked</h2>
      <p class="lock-sub">${error ? error : "Enter your PIN to continue."}</p>
      <div class="lock-dots" id="lockDots"></div>
      <div class="lock-keypad" id="lockKeypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-key="${n}">${n}</button>`).join("")}
        <button type="button" id="lockBiometricBtn" style="visibility:hidden;">🔓</button>
        <button type="button" data-key="0">0</button>
        <button type="button" id="lockBackspaceBtn">⌫</button>
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

  async function submit() {
    if (await verifyPin(entered)) {
      unlock();
    } else {
      entered = "";
      renderDots();
      renderLockScreen("That PIN didn't match — try again.");
    }
  }

  document.querySelectorAll("#lockKeypad [data-key]").forEach((btn) => {
    btn.onclick = () => {
      if (entered.length >= 6) return;
      entered += btn.dataset.key;
      renderDots();
      if (entered.length >= 4) submit(); // PINs are 4–6 digits; try as soon as 4 are in
    };
  });
  document.getElementById("lockBackspaceBtn").onclick = () => {
    entered = entered.slice(0, -1);
    renderDots();
  };
  document.getElementById("lockForgotBtn").onclick = () => {
    if (
      confirm(
        "This removes your PIN lock on this device only — it doesn't touch your account or your data. Continue?",
      )
    ) {
      clearLock();
      unlock();
    }
  };

  if (hasBiometricEnrolled()) {
    const bBtn = document.getElementById("lockBiometricBtn");
    bBtn.style.visibility = "visible";
    bBtn.onclick = attemptBiometric;
    attemptBiometric(); // offer it immediately, no extra tap needed
  }

  async function attemptBiometric() {
    if (await tryBiometricUnlock()) unlock();
  }
}

function unlock() {
  if (overlayEl) overlayEl.classList.remove("show");
  onUnlockedCallback();
}

function showLockIfNeeded() {
  if (!isLockEnabled()) return;
  renderLockScreen();
}

// Called once at startup. `onUnlocked` lets main.js know the gate cleared —
// not required for the initial data load (which proceeds regardless, so the
// app is instantly ready underneath), only used to know when it's safe to,
// say, dismiss a "resuming…" state if you ever add one.
export function initAppLock(onUnlocked = () => {}) {
  onUnlockedCallback = onUnlocked;
  showLockIfNeeded();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > AWAY_LOCK_MS) {
      showLockIfNeeded();
    }
  });
}
