// Renders either a single-action FAB (Goals, Utang, Bills tab — there's only
// one sensible thing to add there, so expanding it would just add a tap) or
// an expanding 3-way stack (Overview/Income/Expenses/Budgets — where "add"
// is ambiguous between expense/income/bill, so the radial menu lets a
// person jump straight to the right one without an extra screen).
const EXPENSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const INCOME_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
const BILL_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

let expanded = false;

// The + button is hidden only on Profile — there's nothing to "add" there.
// It's visible everywhere else, including Overview: it expands into
// Expense/Income/Pay-a-bill on Overview/Income/Expenses/Budgets, and stays
// a single action on the Bills tab and the Goals/Utang sections.
export function shouldShowFab(section, tab) {
  return section !== "profile";
}

export function isFabExpandable(section, tab) {
  return section === "overview" && tab !== "bills";
}

export function renderFab(section, tab) {
  if (!shouldShowFab(section, tab)) return "";

  if (!isFabExpandable(section, tab)) {
    // Single-action FAB — no scrim, no stack, just the button, same as before.
    return `<button class="fab" id="fabBtn">+</button>`;
  }

  return `
  <div class="fab-scrim" id="fabScrim"></div>
  <div class="fab-stack" id="fabStack">
    <button class="fab" id="fabBtn">+</button>
    <div class="fab-mini-list">
      <div class="fab-mini" data-fab-action="expense">
        <span class="fab-mini-label">Expense</span>
        <button class="fab-mini-btn expense">${EXPENSE_ICON}</button>
      </div>
      <div class="fab-mini" data-fab-action="income">
        <span class="fab-mini-label">Income</span>
        <button class="fab-mini-btn income">${INCOME_ICON}</button>
      </div>
      <div class="fab-mini" data-fab-action="bill">
        <span class="fab-mini-label">Pay a bill</span>
        <button class="fab-mini-btn bill">${BILL_ICON}</button>
      </div>
    </div>
  </div>`;
}

// handlers: { onExpense, onIncome, onBill, onDefault }
// onDefault fires for the non-expandable single-action FAB (goals/loans/bills tab).
export function attachFabEvents(section, tab, handlers) {
  expanded = false;
  if (!shouldShowFab(section, tab)) return;
  const fabBtn = document.getElementById("fabBtn");
  if (!fabBtn) return;

  if (!isFabExpandable(section, tab)) {
    fabBtn.onclick = () => handlers.onDefault();
    return;
  }

  const stack = document.getElementById("fabStack");
  const scrim = document.getElementById("fabScrim");

  function setOpen(open) {
    expanded = open;
    stack.classList.toggle("open", open);
    scrim.classList.toggle("show", open);
  }

  fabBtn.onclick = () => setOpen(!expanded);
  scrim.onclick = () => setOpen(false);

  document.querySelectorAll("[data-fab-action]").forEach((el) => {
    el.onclick = () => {
      setOpen(false);
      const action = el.dataset.fabAction;
      if (action === "expense") handlers.onExpense();
      else if (action === "income") handlers.onIncome();
      else if (action === "bill") handlers.onBill();
    };
  });
}
