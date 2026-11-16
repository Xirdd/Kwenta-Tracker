import { state } from "../state.js";

export const TAB_LIST = [
  ["overview", "Overview"],
  ["income", "Income"],
  ["expenses", "Expenses"],
  ["budgets", "Budgets"],
  ["bills", "Bills"],
  ["wallets", "Wallets"],
  ["installments", "Installments"],
];

// A tab can only appear once, even if the list above ever gets the same id or
// the same label added twice (that is what produced two "Installments" pills).
function uniqueTabs(list) {
  const ids = new Set();
  const labels = new Set();
  return list.filter(([id, label]) => {
    if (ids.has(id) || labels.has(label)) return false;
    ids.add(id);
    labels.add(label);
    return true;
  });
}

export function renderTabs() {
  return `
  <div class="tabs" role="tablist" aria-label="Overview sections">
    ${uniqueTabs(TAB_LIST)
      .map(
        ([id, label]) =>
          `<button class="tab-btn ${state.tab === id ? "active" : ""}" role="tab" aria-selected="${state.tab === id}" data-tab="${id}">${label}</button>`,
      )
      .join("")}
  </div>`;
}
