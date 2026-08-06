import { DATA } from "../state.js";
import { fmt, escapeHtml, formatDate } from "../format.js";
import { remainingAmount, isSettled, loanTotals } from "../loans.js";

export function renderLoansTab() {
  const loans = DATA.loans;

  if (loans.length === 0) {
    return `
    <div class="section-title">Utang <span class="sub">who owes who</span></div>
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>Nothing tracked yet.<br/>Tap + to log money you lent or borrowed.</p>
    </div>`;
  }

  const t = loanTotals();

  const sorted = loans.slice().sort((a, b) => {
    const aSettled = isSettled(a);
    const bSettled = isSettled(b);
    if (aSettled !== bSettled) return aSettled ? 1 : -1;
    return (b.date || "").localeCompare(a.date || "");
  });

  const cards = sorted
    .map((loan) => {
      const remaining = remainingAmount(loan);
      const settled = remaining <= 0;
      const owedToYou = loan.direction === "lent";
      const paidPct =
        loan.amount > 0 ? ((loan.amount - remaining) / loan.amount) * 100 : 0;

      return `
    <div class="loan-card" data-loan="${loan.id}">
      <div class="loan-top">
        <div class="loan-person">${escapeHtml(loan.person)}</div>
        <span class="loan-badge ${settled ? "settled" : owedToYou ? "owed" : "owes"}">${settled ? "Settled" : owedToYou ? "Owes you" : "You owe"}</span>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${fmt(remaining)}</span>
        <span class="goal-of">of ${fmt(loan.amount)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(paidPct, 2)}%;background:${settled ? "var(--green)" : owedToYou ? "var(--green)" : "var(--coral)"}"></div></div>
      <div class="loan-meta">${formatDate(loan.date)}${loan.note ? ` · ${escapeHtml(loan.note)}` : ""}</div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Utang <span class="sub">${loans.length} tracked</span></div>
  <div class="loan-summary">
    <div class="loan-summary-item">
      <div class="label">Owed to you</div>
      <div class="amt owed">${fmt(t.owedToYou)}</div>
    </div>
    <div class="loan-summary-item">
      <div class="label">You owe</div>
      <div class="amt owes">${fmt(t.youOwe)}</div>
    </div>
  </div>
  <div class="goal-stack">${cards}</div>
  `;
}
