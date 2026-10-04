import "./authPage.css";
import { supabase } from "../supabaseClient.js";
import {
  signInWithPassword,
  signUpWithPassword,
  sendMagicLink,
} from "../auth.js";
import { isAuthorized, isSessionPending } from "../authGuard.js";
import { escapeHtml } from "../format.js";

// The dedicated Login / Sign up screen. It's a full-screen layer on top of an
// empty #app (main.js clears #app whenever the guard says no), not a modal —
// and it sits just below the sheet layer (z-index 48 vs 50/51), so a 2FA code
// prompt can still open above it during sign-in.
//
// It never navigates anywhere itself. Signing in or up only changes the
// session; main.js's auth listener then loads data and calls hideAuthPage().
//
// Account creation ALWAYS goes through the Sign up tab and requires a
// password. The magic link is a Log in option only (and sendMagicLink in
// auth.js can't create accounts), so nobody can end up without a password.

const GATE_ID = "authGate";
const MIN_PASSWORD = 8;

const svg = (paths) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const MAIL_ICON = svg(
  `<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 8 9 6 9-6"/>`,
);
const LOCK_ICON = svg(
  `<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
);
const EYE_ICON = svg(
  `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
);
const EYE_OFF_ICON = svg(
  `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`,
);

let mode = "login"; // 'login' | 'signup'
let view = null; // 'form' | 'pending' | null (nothing showing)
let leaveTimer = null;

function gateEl() {
  let el = document.getElementById(GATE_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = GATE_ID;
    el.setAttribute("role", "main");
    document.body.appendChild(el);
  }
  return el;
}

// Shows the right view for the current guard state: the loading view while the
// session is pending, the form when signed out. Safe to call repeatedly — it
// does nothing if that view is already on screen, so a stray re-render can't
// wipe what someone is typing.
export function showAuthPage() {
  if (isAuthorized()) return;
  const want = isSessionPending() ? "pending" : "form";
  const existing = document.getElementById(GATE_ID);
  if (existing && !existing.classList.contains("hide") && view === want) return;

  clearTimeout(leaveTimer);
  const el = gateEl();
  el.classList.remove("hide");
  if (want === "form" && view !== "form") mode = "login"; // always open on Log in
  view = want;
  if (want === "pending") renderPending(el);
  else renderForm(el);
}

// Fades the page out once the app is ready underneath.
export function hideAuthPage() {
  const el = document.getElementById(GATE_ID);
  if (!el) return;
  view = null;
  el.classList.add("hide");
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => el.remove(), 260);
}

// The app's real icon file (public/icon-512.png), not a typed "₱".
function brandHtml() {
  return `
  <div class="auth-brand">
    <div class="auth-logo"><img src="/icon-512.png" alt="" width="88" height="88"/></div>
    <h1 class="auth-title">Kwenta</h1>
    <p class="auth-tagline">sulit sa bawat piso</p>
  </div>`;
}

function renderPending(el) {
  el.innerHTML = `
  <div class="auth-wrap">
    ${brandHtml()}
    <div class="splash-loader"><span></span><span></span><span></span></div>
    <p class="auth-pending-text">Just a moment…</p>
  </div>`;
}

// Both modes live in one piece of markup. Switching tabs only flips
// data-mode on the card (CSS shows/hides the mode-specific parts and slides
// the tab pill), so nothing re-renders and what's been typed stays put.
function renderForm(el) {
  el.innerHTML = `
  <div class="auth-wrap">
    ${brandHtml()}
    <div class="auth-card" id="authCard" data-mode="${mode}">
      <div class="auth-seg" role="tablist" aria-label="Log in or sign up">
        <span class="auth-seg-pill" aria-hidden="true"></span>
        <button type="button" class="auth-seg-btn" id="authTabLogin" role="tab">Log in</button>
        <button type="button" class="auth-seg-btn" id="authTabSignup" role="tab">Sign up</button>
      </div>

      <div class="auth-copy">
        <h2 id="authHeading"></h2>
        <p id="authSub"></p>
      </div>

      ${
        supabase
          ? ""
          : `<div class="auth-alert auth-alert-error">Kwenta isn't connected to its server — the Supabase keys are missing from this build.</div>`
      }

      <form id="authForm" novalidate>
        <div class="auth-field">
          <label for="authEmail">Email</label>
          <div class="auth-input">
            <span class="auth-input-icon">${MAIL_ICON}</span>
            <input id="authEmail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="you@example.com"/>
          </div>
        </div>

        <div class="auth-field">
          <label for="authPassword">Password</label>
          <div class="auth-input">
            <span class="auth-input-icon">${LOCK_ICON}</span>
            <input id="authPassword" name="password" type="password" autocomplete="current-password" placeholder="Your password"/>
            <button type="button" class="auth-eye" id="authEye" aria-label="Show password">${EYE_ICON}</button>
          </div>
          <div class="auth-strength only-signup" id="authStrength" data-score="0" aria-live="polite">
            <div class="auth-strength-bars"><span></span><span></span><span></span><span></span></div>
            <span class="auth-strength-label" id="authStrengthLabel">At least ${MIN_PASSWORD} characters</span>
          </div>
        </div>

        <div class="auth-field only-signup">
          <label for="authConfirm">Confirm password</label>
          <div class="auth-input">
            <span class="auth-input-icon">${LOCK_ICON}</span>
            <input id="authConfirm" name="confirm" type="password" autocomplete="new-password" placeholder="Type it again"/>
          </div>
        </div>

        <div class="auth-alert auth-alert-error" id="authError" role="alert" hidden></div>
        <div class="auth-alert auth-alert-info" id="authInfo" role="status" hidden></div>

        <button type="submit" class="auth-primary" id="authSubmit">Log in</button>
      </form>

      <div class="auth-divider only-login"><span>or</span></div>
      <button type="button" class="auth-secondary only-login" id="authMagic">Email me a magic link</button>
      <p class="auth-fine only-signup">You'll set your password now. Magic links stay available for logging in later.</p>
    </div>
    <p class="auth-footnote">Your ledger is private to your account.</p>
  </div>`;

  wireForm();
  applyMode();
}

function $(id) {
  return document.getElementById(id);
}

function currentEmail() {
  const input = $("authEmail");
  return input ? input.value.trim() : "";
}

function setMessage(kind, text) {
  const err = $("authError");
  const info = $("authInfo");
  if (!err || !info) return;
  err.hidden = true;
  info.hidden = true;
  if (!text) return;
  const target = kind === "error" ? err : info;
  target.textContent = text;
  target.hidden = false;
}

// Disables the controls while a request is in flight so a slow connection
// plus an impatient double-tap can't fire it twice.
function setBusy(buttonId, busy, busyLabel) {
  const btn = $(buttonId);
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.textContent = busyLabel;
  } else if (btn.dataset.label) {
    btn.textContent = btn.dataset.label;
  }
  document
    .querySelectorAll("#authCard button")
    .forEach((b) => (b.disabled = busy));
}

// Applies the current mode to everything that isn't pure show/hide CSS.
function applyMode() {
  const isLogin = mode === "login";
  $("authCard").dataset.mode = mode;

  $("authTabLogin").classList.toggle("active", isLogin);
  $("authTabSignup").classList.toggle("active", !isLogin);
  $("authTabLogin").setAttribute("aria-selected", String(isLogin));
  $("authTabSignup").setAttribute("aria-selected", String(!isLogin));

  $("authHeading").textContent = isLogin
    ? "Welcome back"
    : "Create your account";
  $("authSub").textContent = isLogin
    ? "Log in to open your ledger."
    : "Your budget, bills, goals and utang — saved to your own account.";
  $("authSubmit").textContent = isLogin ? "Log in" : "Create account";

  const pw = $("authPassword");
  pw.autocomplete = isLogin ? "current-password" : "new-password";
  pw.placeholder = isLogin
    ? "Your password"
    : `At least ${MIN_PASSWORD} characters`;

  setMessage("error", "");
  updateStrength();
}

// A rough, advisory strength reading — length and variety. Only the minimum
// length is actually enforced; Supabase has the final say on weak passwords.
function scorePassword(pw) {
  if (pw.length < MIN_PASSWORD) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function updateStrength() {
  const box = $("authStrength");
  if (!box) return;
  const pw = $("authPassword").value;
  const labels = ["", "Weak", "Okay", "Good", "Strong"];
  const score = scorePassword(pw);
  box.dataset.score = String(score);
  $("authStrengthLabel").textContent = !pw
    ? `At least ${MIN_PASSWORD} characters`
    : pw.length < MIN_PASSWORD
      ? `${MIN_PASSWORD - pw.length} more character${MIN_PASSWORD - pw.length === 1 ? "" : "s"} needed`
      : labels[score];
}

// Turns Supabase's errors into plain-language messages. Prefers the stable
// `code` field, with the message text as a fallback for older responses.
function friendlyError(e) {
  const code = e?.code || e?.error_code || "";
  const msg = String(e?.message || "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials")
  )
    return "Wrong email or password. Check them and try again.";
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered")
  )
    return "An account with this email already exists. Try logging in instead.";
  if (
    code === "weak_password" ||
    msg.includes("password should") ||
    msg.includes("weak")
  )
    return "That password is too easy to guess — try a longer one with a mix of letters and numbers.";
  if (code === "email_not_confirmed" || msg.includes("not confirmed"))
    return "Confirm your email first — check your inbox for the link.";
  if (code === "otp_disabled" || msg.includes("signups not allowed"))
    return "There's no account with that email yet. Switch to Sign up to create one.";
  if (
    code === "validation_failed" ||
    msg.includes("invalid format") ||
    msg.includes("unable to validate email")
  )
    return "Enter a valid email address.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    msg.includes("rate limit") ||
    e?.status === 429
  )
    return "Too many attempts. Wait a minute and try again.";
  if (msg.includes("failed to fetch") || msg.includes("network"))
    return "Can't reach the server. Check your connection and try again.";
  if (msg.includes("not configured")) return e.message;
  return e?.message || "Something went wrong. Please try again.";
}

function wireForm() {
  $("authTabLogin").onclick = () => {
    mode = "login";
    applyMode();
  };
  $("authTabSignup").onclick = () => {
    mode = "signup";
    applyMode();
  };

  const pw = $("authPassword");
  const confirm = $("authConfirm");

  pw.oninput = updateStrength;

  $("authEye").onclick = () => {
    const showing = pw.type === "text";
    pw.type = showing ? "password" : "text";
    confirm.type = pw.type;
    $("authEye").innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
    $("authEye").setAttribute(
      "aria-label",
      showing ? "Show password" : "Hide password",
    );
  };

  $("authForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const email = currentEmail();
    const password = pw.value;

    if (!email) return setMessage("error", "Enter your email.");
    if (!/^\S+@\S+\.\S+$/.test(email))
      return setMessage("error", "Enter a valid email address.");
    if (!password) return setMessage("error", "Enter your password.");
    if (mode === "signup") {
      if (password.length < MIN_PASSWORD)
        return setMessage(
          "error",
          `Password needs at least ${MIN_PASSWORD} characters.`,
        );
      if (password !== confirm.value)
        return setMessage("error", "Those two passwords don't match.");
    }

    setMessage("error", "");
    setBusy(
      "authSubmit",
      true,
      mode === "login" ? "Logging in…" : "Creating account…",
    );
    try {
      if (mode === "login") {
        await signInWithPassword(email, password);
        // Success changes the session; main.js's auth listener takes over and
        // swaps this page for the loading view, then the app.
      } else {
        const data = await signUpWithPassword(email, password);
        // With email confirmation on, Supabase hides "already registered" by
        // returning a fake user with no identities instead of an error.
        if (
          data?.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          throw { code: "user_already_exists" };
        }
        if (!data.session) {
          // Email confirmation is on: the password is already set, so once
          // they confirm they can simply log in.
          pw.value = "";
          confirm.value = "";
          mode = "login";
          applyMode();
          setMessage(
            "info",
            "Account created! Check your email to confirm it, then log in with your password.",
          );
        }
      }
    } catch (e) {
      setMessage("error", friendlyError(e));
    } finally {
      // If the page was already swapped out on success, there's nothing to reset.
      if ($("authSubmit")) setBusy("authSubmit", false);
    }
  };

  // Log in only (the button is hidden in Sign up mode, and sendMagicLink can't
  // create an account anyway).
  $("authMagic").onclick = async () => {
    const email = currentEmail();
    if (!email) return setMessage("error", "Enter your email first.");
    if (!/^\S+@\S+\.\S+$/.test(email))
      return setMessage("error", "Enter a valid email address.");

    setMessage("error", "");
    setBusy("authMagic", true, "Sending…");
    try {
      await sendMagicLink(email);
      setMessage("info", "Check your email for a sign-in link.");
    } catch (e) {
      setMessage("error", friendlyError(e));
    } finally {
      if ($("authMagic")) setBusy("authMagic", false);
    }
  };
}
