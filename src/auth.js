import { supabase } from "./supabaseClient.js";

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

export async function signOut() {
  requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
