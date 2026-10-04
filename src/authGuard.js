import { getCurrentUser, isRecoveryMode, endRecoveryMode } from "./auth.js";

// The route guard. Kwenta is a single-page app with no URL router, so
// "protecting a route" means one rule that every render goes through: the
// app is only shown when isAuthorized() is true. main.js's render() checks it
// first, so no screen, sheet callback, or realtime refresh can paint protected
// content for a signed-out visitor.
//
// There are four states:
//   signed out            -> login / signup page
//   session pending       -> branded loading view (checking the session, loading
//                            cloud data, or waiting on a 2FA code)
//   password recovery     -> "Set a new password" page (see below)
//   signed in + unlocked  -> the app
//
// "Pending" is deliberately ON from the very first line of startup, until the
// session is known. That's what stops a signed-in person from seeing the login
// form flash for a moment on refresh, and a signed-out one from seeing app UI.
let sessionPending = false;

export function setSessionPending(value) {
  sessionPending = !!value;
}

export function isSessionPending() {
  return sessionPending;
}

// Clicking the link in a "reset your password" email signs the person in with
// a short-lived recovery session. That must NOT open the app — it has to land
// on the "Set a new password" page first. True only when such a session exists.
export function isRecoveryActive() {
  return isRecoveryMode() && !!getCurrentUser();
}

// Called by the reset page once the new password is saved. main.js registers
// what happens next (load the data and open the Dashboard).
let recoveryDone = () => {};

export function onRecoveryComplete(callback) {
  recoveryDone = callback;
}

export function completeRecovery() {
  endRecoveryMode();
  recoveryDone();
}

// True only when there is a session, it has been fully unlocked (any required
// 2FA challenge is done and the person's data has loaded), and it isn't a
// password-recovery session still waiting for its new password.
export function isAuthorized() {
  return !!getCurrentUser() && !sessionPending && !isRecoveryActive();
}