import "./authPage.css";
import { supabase } from "../supabaseClient.js";
import {
  signInWithPassword,
  signUpWithPassword,
  sendMagicLink,
  markPendingPasswordSetup,
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

const GATE_ID = "authGate";
const MIN_PASSWORD = 6; // Supabase's default minimum

const EYE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

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
  view = want;
  if (want === "pending") renderPending(el);
  else renderForm(el, {});
}

// Fades the page out once the app is ready underneath.
export function hideAuthPage() {
  const el = document.getElementById(GATE_ID);
  if (!el) return;
  view = null;
  mode = "login"; // next visit starts on Log in again
  el.classList.add("hide");
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => el.remove(), 260);
}

function brandHtml() {
  return `
  <div class="auth-brand">
    <div class="auth-logo">₱</div>
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

function renderForm(el, { email = "", error = "", info = "" }) {
  const isLogin = mode === "login";
  el.innerHTML = `
  <div class="auth-wrap">
    ${brandHtml()}
    <div class="auth-card">
      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab ${isLogin ? "active" : ""}" id="authTabLogin" role="tab" aria-selected="${isLogin}">Log in</button>
        <button type="button" class="auth-tab ${isLogin ? "" : "active"}" id="authTabSignup" role="tab" aria-selected="${!isLogin}">Sign up</button>
      </div>
      <h2 class="auth-heading">${isLogin ? "Welcome back" : "Create your account"}</h2>
      <p class="auth-sub">${isLogin ? "Log in to open your ledger." : "Your budget, bills, goals and utang — saved to your own account."}</p>
      ${
        supabase
          ? ""
          : `<p class="auth-message auth-error">Kwenta isn't connected to its server — the Supabase keys are missing from this build.</p>`
      }
      <form id="authForm" novalidate>
        <div class="field">
          <label for="authEmail">Email</label>
          <input id="authEmail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="you@example.com" value="${escapeHtml(email)}"/>
        </div>
        <div class="field">
          <label for="authPassword">Password</label>
          <div class="auth-pw-wrap">
            <input id="authPassword" name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="${isLogin ? "Your password" : `At least ${MIN_PASSWORD} characters`}"/>
            <button type="button" class="auth-pw-toggle" id="authPwToggle" aria-label="Show password">${EYE}</button>
          </div>
          ${isLogin ? "" : `<p class="field-hint">Use at least ${MIN_PASSWORD} characters — longer is stronger.</p>`}
        </div>
        <p class="auth-message auth-error" id="authError" role="alert" ${error ? "" : "hidden"}>${escapeHtml(error)}</p>
        <p class="auth-message auth-info" id="authInfo" role="status" ${info ? "" : "hidden"}>${escapeHtml(info)}</p>
        <button type="submit" class="btn btn-primary auth-submit" id="authSubmit">${isLogin ? "Log in" : "Create account"}</button>
      </form>
      <div class="auth-divider"><span>or</span></div>
      <button type="button" class="btn btn-ghost auth-submit" id="authMagic">Email me a magic link</button>
    </div>
    <p class="auth-footnote">Your ledger is private to your account.</p>
  </div>`;

  wireForm(el);
}

function currentEmail() {
  const input = document.getElementById("authEmail");
  return input ? input.value.trim() : "";
}

function setMessage(kind, text) {
  const err = document.getElementById("authError");
  const info = document.getElementById("authInfo");
  if (!err || !info) return;
  err.hidden = true;
  info.hidden = true;
  const target = kind === "error" ? err : info;
  if (text) {
    target.textContent = text;
    target.hidden = false;
  }
}

function setBusy(buttonId, busy, busyLabel) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.textContent = busyLabel;
  } else if (btn.dataset.label) {
    btn.textContent = btn.dataset.label;
  }
  document
    .querySelectorAll("#authForm button, #authMagic, .auth-tab")
    .forEach((b) => {
      b.disabled = busy;
    });
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
    return `That password is too weak — use at least ${MIN_PASSWORD} characters and avoid common ones.`;
  if (code === "email_not_confirmed" || msg.includes("not confirmed"))
    return "Confirm your email first — check your inbox for the link.";
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

function wireForm(el) {
  document.getElementById("authTabLogin").onclick = () => {
    mode = "login";
    renderForm(el, { email: currentEmail() });
  };
  document.getElementById("authTabSignup").onclick = () => {
    mode = "signup";
    renderForm(el, { email: currentEmail() });
  };

  const pw = document.getElementById("authPassword");
  const toggle = document.getElementById("authPwToggle");
  toggle.onclick = () => {
    const showing = pw.type === "text";
    pw.type = showing ? "password" : "text";
    toggle.innerHTML = showing ? EYE : EYE_OFF;
    toggle.setAttribute(
      "aria-label",
      showing ? "Show password" : "Hide password",
    );
  };

  document.getElementById("authForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const email = currentEmail();
    const password = pw.value;

    if (!email) return setMessage("error", "Enter your email.");
    if (!/^\S+@\S+\.\S+$/.test(email))
      return setMessage("error", "Enter a valid email address.");
    if (!password) return setMessage("error", "Enter your password.");
    if (mode === "signup" && password.length < MIN_PASSWORD)
      return setMessage(
        "error",
        `Password needs at least ${MIN_PASSWORD} characters.`,
      );

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
          mode = "login";
          renderForm(el, {
            email,
            info: "Account created! Check your email to confirm it, then log in.",
          });
          return;
        }
      }
    } catch (e) {
      setMessage("error", friendlyError(e));
    } finally {
      // If the page was already swapped out on success, there's nothing to reset.
      if (document.getElementById("authSubmit")) setBusy("authSubmit", false);
    }
  };

  document.getElementById("authMagic").onclick = async () => {
    const email = currentEmail();
    if (!email) return setMessage("error", "Enter your email first.");
    if (!/^\S+@\S+\.\S+$/.test(email))
      return setMessage("error", "Enter a valid email address.");

    setMessage("error", "");
    setBusy("authMagic", true, "Sending…");
    try {
      await sendMagicLink(email);
      if (mode === "signup") markPendingPasswordSetup(); // only once the email actually sent
      setMessage("info", "Check your email for a sign-in link.");
    } catch (e) {
      setMessage("error", friendlyError(e));
    } finally {
      if (document.getElementById("authMagic")) setBusy("authMagic", false);
    }
  };
}
