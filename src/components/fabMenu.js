// The + button is now a single, non-expanding action button. Which form it
// opens depends entirely on where you are: Expenses -> add expense, Income
// -> add income, Bills -> add bill, Goals -> add goal, Utang -> add loan.
// There's no ambiguity to resolve with a popup menu anymore, since each of
// these screens already implies exactly one thing worth adding — and each
// of those forms already scopes its own category picker to the relevant
// type (CATEGORIES vs INCOME_CATEGORIES), so "context-aware categories" falls
// out naturally rather than needing a separate mechanism here.

// Overview (the summary tab) and Budgets (edited inline via each row's own
// input, nothing to "add") are the two screens with no + button at all.
const HIDDEN_TABS = new Set(["overview", "budgets"]);

export function shouldShowFab(section, tab) {
  if (section === "profile") return false;
  if (section === "overview") return !HIDDEN_TABS.has(tab);
  return true; // goals, loans
}

export function renderFab(section, tab) {
  if (!shouldShowFab(section, tab)) return "";
  return `<button class="fab" id="fabBtn">+</button>`;
}

// handlers: { onExpense, onIncome, onBill, onGoal, onLoan }
export function attachFabEvents(section, tab, handlers) {
  const fabBtn = document.getElementById("fabBtn");
  if (!fabBtn) return;

  fabBtn.onclick = () => {
    if (section === "goals") return handlers.onGoal();
    if (section === "loans") return handlers.onLoan();
    if (tab === "income") return handlers.onIncome();
    if (tab === "expenses") return handlers.onExpense();
    if (tab === "bills") return handlers.onBill();
  };
}
