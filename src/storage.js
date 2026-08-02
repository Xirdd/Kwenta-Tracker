const STORAGE_KEY = 'kwenta_data_v1';

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        salary: parsed.salary || {},
        transactions: parsed.transactions || [],
        budgets: parsed.budgets || {},
      };
    }
  } catch (e) {
    console.error('Failed to load Kwenta data', e);
  }
  return { salary: {}, transactions: [], budgets: {} };
}

let saveTimer = null;
export function persist(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save Kwenta data', e);
    }
  }, 250);
}
