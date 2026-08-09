import { supabase } from "./supabaseClient.js";
import { clearLocalData } from "./storage.js";

let currentUser = null;
const listeners = [];

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

export async function signUpWithPassword(email, password) {
  requireSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// Passwordless: works for both new and existing accounts.
export async function sendMagicLink(email) {
  requireSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

const PENDING_PASSWORD_KEY = "kwenta_awaiting_password_setup";

// Marks that the next successful sign-in came from a magic-link *signup*,
// so the app knows to offer setting a password afterward.
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

export async function signOut() {
  requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Sets/changes the password on the currently signed-in user (works for
// accounts that signed up passwordless via magic link, too).
export async function updateUserPassword(password) {
  requireSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
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
