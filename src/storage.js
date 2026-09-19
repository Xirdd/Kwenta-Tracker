import { dataPesosToCentavos } from "./money.js";

// v2 holds INTEGER CENTAVOS. v1 held peso floats and is only ever read (once,
// to migrate) — never written again. Using a new key instead of a flag inside
// the old blob means an old cached copy of the app can't ever misread
// centavos as pesos, and v1 stays untouched as a rollback copy.
const STORAGE_KEY = "kwenta_data_v2";
const LEGACY_STORAGE_KEY = "kwenta_data_v1";

function shape(parsed) {
  return {
    salary: parsed.salary || {},
    transactions: parsed.transactions || [],
    budgets: parsed.budgets || {},
    recurring: parsed.recurring || [],
    bills: parsed.bills || [],
    goals: parsed.goals || [],
    loans: parsed.loans || [],
  };
}

function emptyData() {
  return shape({});
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return shape(JSON.parse(raw));

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = dataPesosToCentavos(shape(JSON.parse(legacyRaw)));
      // Written immediately (not through the debounced persist()) so the
      // conversion is guaranteed to run exactly once.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (e) {
    console.error("Failed to load Kwenta data", e);
  }
  return emptyData();
}

let saveTimer = null;
export function persist(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save Kwenta data", e);
    }
  }, 250);
}

// Used when deleting an account — without this, the old cached data would
// still be sitting in localStorage and could reappear (e.g. offline mode)
// even after the cloud copy is gone. Clears the legacy v1 copy too, or
// loadData() would just migrate it straight back in.
export function clearLocalData() {
  clearTimeout(saveTimer);
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
}
