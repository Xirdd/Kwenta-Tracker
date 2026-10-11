import { supabase } from "./supabaseClient.js";

function requireSupabase() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
    );
}

// Starts enrolling a new TOTP (authenticator app) factor. Returns a
// ready-to-render QR code SVG plus the raw secret as a manual-entry
// fallback for anyone who can't scan it.
//
// Any half-finished enrollment from an earlier attempt (the sheet was
// cancelled or dismissed before the code was verified) is removed first.
// Those "unverified" factors used to pile up and eventually made enrolling
// fail.
export async function enrollTotp() {
  requireSupabase();
  await removeUnverifiedFactors();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

async function removeUnverifiedFactors() {
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    const stale = (data?.all || []).filter((f) => f.status === "unverified");
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  } catch (e) {
    /* best effort — enroll() below reports any real problem */
  }
}

// Called when the setup sheet is cancelled before verification.
export async function cancelEnrollment(factorId) {
  if (!supabase || !factorId) return;
  try {
    await supabase.auth.mfa.unenroll({ factorId });
  } catch (e) {
    /* best effort */
  }
}

// One challenge + verify round trip. Used both to activate a newly enrolled
// factor (it stays "unverified" until you prove you can generate a real code
// from it once) and at sign-in, where the session already passed the first
// factor (password or magic link) but is still only at aal1 — this completes
// the upgrade to aal2. These were two byte-for-byte identical functions.
async function challengeAndVerify(factorId, code) {
  requireSupabase();
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) throw verifyError;
}

export const verifyTotpEnrollment = challengeAndVerify;
export const challengeAndVerifyTotp = challengeAndVerify;

export async function listTotpFactors() {
  requireSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp || []).filter((f) => f.status === "verified");
}

export async function unenrollTotp(factorId) {
  requireSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

// True if this session still needs a TOTP code before it's fully signed
// in — i.e. the account has a verified factor, but this particular session
// (this device, this login) hasn't completed the second factor yet.
export async function needsMfaChallenge() {
  requireSupabase();
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false; // fail open on a check error rather than locking someone out entirely
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

// The verified factor to challenge against, for the sign-in-time prompt.
export async function getChallengeFactor() {
  const factors = await listTotpFactors();
  return factors[0] || null;
}

// Called right after 2FA is successfully enabled — replaces any existing
// codes and returns the new set in plain text, the only moment they're ever
// visible anywhere (the database only ever stores a bcrypt hash of each).
export async function generateRecoveryCodes() {
  requireSupabase();
  const { data, error } = await supabase.rpc("generate_mfa_recovery_codes");
  if (error) throw error;
  return data || [];
}

// True if the code matched one of this account's unused recovery codes —
// and, if so, it's now been consumed (one-time use). The caller is
// responsible for actually disabling 2FA when this returns true; using a
// recovery code doesn't upgrade the session to aal2 (there's no real TOTP
// proof happening), it just verifies enough identity to remove the second
// factor and let the person back in — same pattern GitHub/Google use.
// The database now throttles wrong guesses (5 per 15 minutes) and raises an
// error — shown to the person as-is — when the limit is hit.
export async function verifyRecoveryCode(code) {
  requireSupabase();
  const { data, error } = await supabase.rpc("verify_mfa_recovery_code", {
    input_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return !!data;
}

export async function countRemainingRecoveryCodes() {
  requireSupabase();
  const { data, error } = await supabase.rpc(
    "count_remaining_mfa_recovery_codes",
  );
  if (error) throw error;
  return data || 0;
}
