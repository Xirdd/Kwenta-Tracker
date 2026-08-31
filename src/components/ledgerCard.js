import { state } from "../state.js";
import { fmt } from "../format.js";

export function renderLedgerCard(t) {
  const neg = t.balance < 0;
  return `
  <div class="balance-hero">
    <div class="eyebrow">Net balance · ${state.monthKey}</div>
    <div class="balance-amount ${neg ? "negative" : ""}">${neg ? "-" : ""}${fmt(Math.abs(t.balance))}</div>
    <div class="hero-stats-row">
      <div class="hero-stat-inline">
        <div class="label"><span class="dot" style="background:var(--green)"></span>Income</div>
        <div class="amt">${fmt(t.totalIncome)}</div>
      </div>
      <div class="hero-stat-inline">
        <div class="label"><span class="dot" style="background:var(--coral)"></span>Expenses</div>
        <div class="amt">${fmt(t.totalExpense)}</div>
      </div>
    </div>
  </div>`;
}
