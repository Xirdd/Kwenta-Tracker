const STORAGE_KEY = "kwenta_data_v1";

function blank() {
  return {
    salary: {},
    transactions: [],
    budgets: {},
    budgetsSecond: {},
    customCategories: [],
    recurring: [],
    bills: [],
    goals: [],
    loans: [],
  };
}

// `ownerId` is the signed-in user's id, when known. Pass it whenever you
// have it (anywhere after sign-in) so a cache that belongs to someone else
// is never read back.
//
// Why this matters: if a session ends on the SERVER (expiry, revoke) while
// the app isn't open, main.js's normal sign-out cleanup (clearLocalData())
// never runs — there's no app running to run it. The next time Kwenta opens
// on that device, the previous person's data is still in localStorage and
// gets loaded "in case this is the very first sign-in on this device" (see
// state.js's initData), for the one-time local→cloud migration. If a
// DIFFERENT person then signs up on that same device, their empty new
// account would silently receive the previous person's entries.
//
// Fix: every save is tagged with the id of whoever was signed in at the
// time (undefined for data saved before accounts were required, or while
// signed out — that case is unaffected and still migrates once, as before).
// A read that names an `ownerId` and finds a MISMATCHED tag treats the
// cache as empty and wipes it, rather than ever handing it back.
export function loadData(ownerId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (ownerId && parsed.ownerId && parsed.ownerId !== ownerId) {
        clearLocalData();
        return blank();
      }
      return {
        salary: parsed.salary || {},
        transactions: parsed.transactions || [],
        budgets: parsed.budgets || {},
        budgetsSecond: parsed.budgetsSecond || {},
        customCategories: parsed.customCategories || [],
        recurring: parsed.recurring || [],
        bills: parsed.bills || [],
        goals: parsed.goals || [],
        loans: parsed.loans || [],
      };
    }
  } catch (e) {
    console.error("Failed to load Kwenta data", e);
  }
  return blank();
}

// Saves are debounced (250 ms) so typing doesn't hammer localStorage. A
// phone can suspend or kill a PWA the moment you switch away, though, which
// used to drop a save that was still waiting on that timer. `pending` holds
// the latest data and is flushed immediately when the page is hidden.
let saveTimer = null;
let pending = null;

function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!pending) return;
  const payload = pending;
  pending = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Failed to save Kwenta data", e);
  }
}

export function persist(data, ownerId) {
  pending = ownerId ? { ...data, ownerId } : data;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

export function clearLocalData() {
  // Drop anything still waiting to be written — otherwise a late flush would
  // put a signed-out (or wrong-account) person's data straight back.
  clearTimeout(saveTimer);
  saveTimer = null;
  pending = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
}
