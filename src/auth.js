import { supabase } from "./supabaseClient.js";
import { clearLocalData } from "./storage.js";

let currentUser = null;
const listeners = [];

// ── Email-link landings (password reset, expired links) ──────────────────
// The link in a "reset your password" email comes back to the app with
// "#...&type=recovery" in the URL, and Supabase signs the person in with a
// recovery session and then wipes that URL. So this has to be read right now,
// at import time, before that happens. A reset link must lead to the
// "Set a new password" page, not straight into the app — the flag is kept in
// sessionStorage so a reload on that page doesn't skip past it.
const RECOVERY_KEY = "kwenta_password_recovery";
let pendingLinkError = null;

(function captureEmailLinkLanding() {
  try {
    const hash = window.location.hash || "";
    if (/(?:^|[#&])type=recovery(?:&|$)/.test(hash)) {
      sessionStorage.setItem(RECOVERY_KEY, "1");
    }
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (params.get("error_code") || params.get("error")) {
      pendingLinkError =
        "That email link has expired or was already used. Request a fresh one and try again.";
    }
  } catch (e) {
    /* storage or URL parsing unavailable — treat as a normal page load */
  }
})();

// True while this tab is in a password-recovery session that still needs its
// new password. (Whether a session actually exists is checked in authGuard.js.)
export function isRecoveryMode() {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function endRecoveryMode() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch (e) {
    /* ignore */
  }
}

// The "link expired" message from the URL we landed on, once — so the login
// page can show it a single time rather than on every render.
export function consumeLinkError() {
  const message = pendingLinkError;
  pendingLinkError = null;
  return message;
}

export function getCurrentUser() {
  return currentUser;
}

// Call once on startup. Resolves once the initial session (if any) is known.
export async function initAuth() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (!currentUser) endRecoveryMode(); // logged out (or cancelled): no reset left to finish
    listeners.forEach((cb) => cb(currentUser));
  });
  return currentUser;
}

// Registers a callback fired whenever the signed-in user changes (sign in, sign out, token refresh).
export function onAuthChange(cb) {
  listeners.push(cb);
}

function requireSupabase() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
    );
}

export async function signInWithPassword(email, password) {
  requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// Creating an account always starts here, with a password. This is the ONLY
// way to make a new account — see sendMagicLink below.
export async function signUpWithPassword(email, password) {
  requireSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// Passwordless LOGIN for an account that already exists. It deliberately
// cannot create one: with shouldCreateUser left at its default (true), asking
// for a magic link on an unknown email would silently create an account that
// has no password — exactly the dead end signup is meant to prevent. With it
// off, an unknown email gets an error instead ("Signups not allowed for otp").
export async function sendMagicLink(email) {
  requireSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser: false,
    },
  });
  if (error) throw error;
}

// Emails a "choose a new password" link. Supabase reports success whether or
// not the address has an account (on purpose — otherwise this could be used to
// find out who's registered), so the UI words its confirmation the same way.
// The link returns to the app root, which is already allowed as a redirect
// URL because magic links use it too.
export async function requestPasswordReset(email) {
  requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

const PENDING_PASSWORD_KEY = "kwenta_awaiting_password_setup";

// Marks that the next successful sign-in came from a magic-link *signup*,
// so the app knows to offer setting a password afterward. Signup no longer
// goes through a magic link, so nothing sets this flag anymore; it's kept so
// an older flag left on a device still resolves cleanly.
export function markPendingPasswordSetup() {
  try {
    localStorage.setItem(PENDING_PASSWORD_KEY, "1");
  } catch (e) {
    /* ignore */
  }
}

// Checks (and clears) the flag above. Call once per sign-in.
export function consumePendingPasswordSetup() {
  try {
    const pending = localStorage.getItem(PENDING_PASSWORD_KEY) === "1";
    localStorage.removeItem(PENDING_PASSWORD_KEY);
    return pending;
  } catch (e) {
    return false;
  }
}

// Removes Supabase's stored session tokens from this device.
function purgeStoredSession() {
  try {
    Object.keys(localStorage)
      .filter((k) => /^sb-.+-auth-token(-code-verifier)?$/.test(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    /* ignore */
  }
}

export async function signOut() {
  requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (!error) return; // normal path: Supabase cleared the session and fired SIGNED_OUT

  // Couldn't reach the server (offline, say). supabase-js leaves the session
  // in place when that happens, which would make "Log out" silently do nothing
  // and leave the person logged in. Clear it on this device ourselves, tell the
  // app (so the login wall, data wipe and lock reset all run), then reload so
  // the in-memory copy of the session is gone too.
  console.error("Server sign-out failed; clearing the local session", error);
  purgeStoredSession();
  endRecoveryMode();
  if (currentUser) {
    currentUser = null;
    listeners.forEach((cb) => cb(null));
  }
  setTimeout(() => window.location.reload(), 300);
}

// Sets/changes the password on the currently signed-in user (works for
// accounts that signed up passwordless via magic link, too).
export async function updateUserPassword(password) {
  requireSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// ── Profile (name/birthday) ──────────────────────────────────────────────
// Stored in Supabase auth's own user_metadata (raw_user_meta_data) rather
// than a new table — it's already part of the session object, so it needs
// no separate fetch, no RLS policy of its own, and syncs across devices for
// free the same way the email/account info already does.
export function getUserProfile() {
  const meta = currentUser?.user_metadata || {};
  return {
    fullName: meta.full_name || "",
    birthday: meta.birthday || "",
  };
}

export async function updateUserProfile({ fullName, birthday }) {
  requireSupabase();
  const { data, error } = await supabase.auth.updateUser({
    data: { full_name: fullName || null, birthday: birthday || null },
  });
  if (error) throw error;
  // updateUser() resolves with the fresh user object before the
  // onAuthStateChange listener fires — update the local copy immediately so
  // a render right after saving already reflects the new name/birthday.
  if (data?.user) currentUser = data.user;
}

// Wipes every transaction/budget/goal/loan/bill/recurring rule the current
// user owns, removes them from any household, clears the local offline
// cache, and signs out. Does NOT delete the underlying auth.users row —
// that needs the service-role key, which a client must never hold. See
// supabase/functions/delete-account/ for the optional server-side piece
// that removes the account record itself.
export async function deleteMyAccountData() {
  requireSupabase();
  const { error } = await supabase.rpc("delete_my_account_data");
  if (error) throw error;
  clearLocalData();
  await signOut();
}

// Returns every active session for the current user, newest-active first,
// plus which one is the current device (so the UI can label it). The
// client's Session object doesn't directly expose a session id — it's
// embedded in the access token's JWT payload as a 'session_id' claim, so
// that gets decoded out rather than assumed to be a top-level field.
export async function listMySessions() {
  requireSupabase();
  const [
    { data: sessions, error: listError },
    { data: sessionData, error: sessionError },
  ] = await Promise.all([
    supabase.rpc("list_my_sessions"),
    supabase.auth.getSession(),
  ]);
  if (listError) throw listError;
  if (sessionError) throw sessionError;
  return {
    sessions: sessions || [],
    currentSessionId: decodeJwtSessionId(sessionData.session?.access_token),
  };
}

function decodeJwtSessionId(accessToken) {
  if (!accessToken) return null;
  try {
    const payloadPart = accessToken.split(".")[1];
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload.session_id || null;
  } catch (e) {
    return null;
  }
}

// Signs out every session except this one — the person stays signed in here,
// everywhere else gets logged out. There's no way to target one specific
// other device individually without the service-role key, so "all others"
// is the finest control available client-side.
export async function signOutOtherDevices() {
  requireSupabase();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw error;
}