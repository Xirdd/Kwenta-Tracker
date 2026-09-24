const STORAGE_KEY = "kwenta_data_v1";

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        salary: parsed.salary || {},
        transactions: parsed.transactions || [],
        budgets: parsed.budgets || {},
        budgetsSecond: parsed.budgetsSecond || {},
        recurring: parsed.recurring || [],
        bills: parsed.bills || [],
        goals: parsed.goals || [],
        loans: parsed.loans || [],
      };
    }
  } catch (e) {
    console.error("Failed to load Kwenta data", e);
  }
  return {
    salary: {},
    transactions: [],
    budgets: {},
    budgetsSecond: {},
    recurring: [],
    bills: [],
    goals: [],
    loans: [],
  };
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

export function clearLocalData() {
  clearTimeout(saveTimer);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
}
