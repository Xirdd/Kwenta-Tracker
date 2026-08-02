import { state } from "../state.js";
import { fmt } from "../format.js";

export function renderLedgerCard(t) {
  const neg = t.balance < 0;
  return `
  <div class="ledger-card">
    <span class="tab">Page ${state.monthKey}</span>
    <div class="eyebrow">Net balance</div>
    <div class="balance-amount ${neg ? "negative" : ""}">${neg ? "-" : ""}${fmt(Math.abs(t.balance))}</div>
    <hr class="ledger-rule"/>
    <div class="mini-stats">
      <div class="mini-stat">
        <div class="label"><span class="dot" style="background:var(--green)"></span>Income</div>
        <div class="amt">${fmt(t.totalIncome)}</div>
      </div>
      <div class="mini-stat">
        <div class="label"><span class="dot" style="background:var(--coral)"></span>Expenses</div>
        <div class="amt">${fmt(t.totalExpense)}</div>
      </div>
    </div>
  </div>`;
}
