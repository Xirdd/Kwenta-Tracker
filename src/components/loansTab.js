import { DATA } from "../state.js";
import { fmt, escapeHtml, formatDate } from "../format.js";
import { remainingAmount, loanTotals } from "../loans.js";
import { goalAccentColor } from "./goalsTab.js";

// Up to two letters: "Ate Jhen" -> "AJ", "Mark" -> "M".
function initialsOf(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const letters =
    parts.length === 1
      ? parts[0].charAt(0)
      : parts[0].charAt(0) + parts[1].charAt(0);
  return letters.toUpperCase();
}

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

  // The remaining balance is computed once per loan. The old sort called
  // isSettled() (which re-scanned every transaction) on every comparison.
  const rows = loans
    .map((loan) => ({ loan, remaining: remainingAmount(loan) }))
    .sort((a, b) => {
      const aSettled = a.remaining <= 0;
      const bSettled = b.remaining <= 0;
      if (aSettled !== bSettled) return aSettled ? 1 : -1;
      return (b.loan.date || "").localeCompare(a.loan.date || "");
    });

  const cards = rows
    .map(({ loan, remaining }) => {
      const settled = remaining <= 0;
      const owedToYou = loan.direction === "lent";
      const paidPct =
        loan.amount > 0 ? ((loan.amount - remaining) / loan.amount) * 100 : 0;
      // This colour carries meaning (green = owed to you, coral = you owe).
      const accent = settled
        ? "var(--muted)"
        : owedToYou
          ? "var(--green)"
          : "var(--coral)";
      const avatar = goalAccentColor(loan.person || loan.id);

      return `
    <div class="loan-card ${settled ? "settled" : ""}" data-loan="${loan.id}" style="--loan-accent:${accent};">
      <div class="loan-glow"></div>
      <div class="loan-top">
        <div class="loan-person-row">
          <span class="loan-avatar" style="background:${avatar}26;color:${avatar};" aria-hidden="true">${escapeHtml(initialsOf(loan.person))}</span>
          <div class="loan-person">${escapeHtml(loan.person)}</div>
        </div>
        <span class="loan-badge ${settled ? "settled" : owedToYou ? "owed" : "owes"}">${settled ? "Settled" : owedToYou ? "Owes you" : "You owe"}</span>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${fmt(remaining)}</span>
        <span class="goal-of">of ${fmt(loan.amount)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(paidPct, 2)}%;background:${settled || owedToYou ? "var(--green)" : "var(--coral)"}"></div></div>
      <div class="loan-meta">${formatDate(loan.date)}${loan.note ? ` · ${escapeHtml(loan.note)}` : ""}</div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Utang <span class="sub">${loans.length} tracked</span></div>
  <div class="goal-stack">${cards}</div>
  `;
}

// Shown in the sidebar in place of the month Net Balance hero, since Utang
// isn't scoped to a month — this is the running "who owes who" position.
// Same borderless treatment as renderLedgerCard(), for consistency.
export function renderUtangLedgerCard() {
  const t = loanTotals();
  const net = t.owedToYou - t.youOwe;
  const neg = net < 0;

  return `
  <div class="balance-hero">
    <div class="eyebrow">Utang · net position</div>
    <div class="balance-amount ${neg ? "negative" : ""}">${neg ? "-" : ""}${fmt(Math.abs(net))}</div>
    <div class="hero-stats-row">
      <div class="hero-stat-inline">
        <div class="label"><span class="dot" style="background:var(--green)"></span>Owed to you</div>
        <div class="amt">${fmt(t.owedToYou)}</div>
      </div>
      <div class="hero-stat-inline">
        <div class="label"><span class="dot" style="background:var(--coral)"></span>You owe</div>
        <div class="amt">${fmt(t.youOwe)}</div>
      </div>
    </div>
  </div>`;
}
