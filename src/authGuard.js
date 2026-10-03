import { getCurrentUser } from "./auth.js";

// The route guard. Kwenta is a single-page app with no URL router, so
// "protecting a route" means one rule that every render goes through: the
// app is only shown when isAuthorized() is true. main.js's render() checks it
// first, so no screen, sheet callback, or realtime refresh can paint protected
// content for a signed-out visitor.
//
// There are three states:
//   signed out            -> login / signup page
//   session pending       -> branded loading view (checking the session, loading
//                            cloud data, or waiting on a 2FA code)
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

// True only when there is a session AND it has been fully unlocked — that is,
// any required 2FA challenge is done and the person's data has loaded.
export function isAuthorized() {
  return !!getCurrentUser() && !sessionPending;
}
