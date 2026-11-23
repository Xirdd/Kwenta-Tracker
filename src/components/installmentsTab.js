import { catInfo, categoryIconBadge } from "../categories.js";
import { fmt, escapeHtml } from "../format.js";
import { sortList } from "../sorting.js";
import { renderSortButton } from "./sortControl.js";
import {
  INSTALLMENT_CATEGORY,
  isActive,
  progressLabel,
  progressPercent,
  remainingBalance,
  dueRuleLabel,
  monthlyDues,
  installmentTotals,
  uniquePlans,
} from "../installments.js";

// Badge for this month's payment: Paid / Overdue / Due today / Due in Nd.
function dueBadge(due) {
  if (due.paidTx) return { text: "Paid", cls: "paid" };
  const d = due.daysLeft;
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, cls: "overdue" };
  if (d === 0) return { text: "Due today", cls: "soon" };
  return { text: `Due in ${d}d`, cls: d <= 3 ? "soon" : "later" };
}

// ── The Installments tab ────────────────────────────────────────────────
export function renderInstallmentsTab() {
  const plans = uniquePlans();

  if (plans.length === 0) {
    return `
    <div class="section-title">Installments <span class="sub">SPayLater &amp; payment plans</span></div>
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>No installments yet.<br/>Tap + to track SPayLater or any plan you pay off monthly.</p>
    </div>`;
  }

  const t = installmentTotals();
  const dueById = new Map(monthlyDues().map((d) => [d.plan.id, d]));
  const sorted = sortList("installments", plans);

  const cards = sorted
    .map((plan) => {
      const done = !isActive(plan);
      const due = dueById.get(plan.id);
      const badge = done
        ? { text: "Completed", cls: "settled" }
        : due
          ? dueBadge(due)
          : { text: "Active", cls: "later" };
      const pct = progressPercent(plan);
      const accent = done ? "var(--muted)" : "var(--gold)";

      return `
    <div class="loan-card ${done ? "settled" : ""}" data-installment="${escapeHtml(plan.id)}" style="--loan-accent:${accent};">
      <div class="loan-glow"></div>
      <div class="loan-top">
        <div class="loan-person-row">
          ${categoryIconBadge(catInfo(INSTALLMENT_CATEGORY), 32)}
          <div class="loan-person">${escapeHtml(plan.name)}</div>
        </div>
        <span class="bill-badge ${badge.cls}">${escapeHtml(badge.text)}</span>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${fmt(plan.monthlyAmount)}</span>
        <span class="goal-of">/ month · ${escapeHtml(dueRuleLabel(plan.dueRule, { short: true }))}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 2)}%;background:${done ? "var(--green)" : "var(--gold)"}"></div></div>
      <div class="loan-meta">${escapeHtml(progressLabel(plan))}${done ? "" : ` · ${plan.remainingMonths} left · ${fmt(remainingBalance(plan))} to go`}</div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Installments <span class="sub">${plans.length} tracked</span></div>
  <div class="stat-strip">
    <div class="stat-chip">
      <div class="label">To pay this month</div>
      <div class="value" style="color:${t.toPayTotal > 0 ? "var(--coral)" : "var(--green)"};">${fmt(t.toPayTotal)}</div>
    </div>
    <div class="stat-chip">
      <div class="label">Total still owed</div>
      <div class="value">${fmt(t.balance)}</div>
    </div>
  </div>
  ${renderSortButton("installments")}
  <div class="goal-stack">${cards}</div>
  `;
}

// ── Overview: "Installments due this month" ─────────────────────────────
// Sits under Upcoming bills. Shows what each plan asks for this month and
// whether it is paid. (Paid payments are ordinary expenses, so they are
// already inside the Overview totals and the "Installments / SPayLater"
// budget category — this card is for what is still to come.) Rows carry
// data-installment, so main.js opens the same detail sheet from here.
export function renderInstallmentsDue() {
  const dues = monthlyDues();
  if (dues.length === 0) return "";
  const t = installmentTotals();
  const c = catInfo(INSTALLMENT_CATEGORY);

  return `
  <div class="section-title">Installments <span class="sub">${t.toPayTotal > 0 ? `${fmt(t.toPayTotal)} to pay` : "all paid this month"}</span></div>
  <div class="ov-card" style="margin-bottom:24px;">
    ${dues
      .map((d) => {
        const badge = dueBadge(d);
        return `
      <div class="ov-bill-row" data-installment="${escapeHtml(d.plan.id)}">
        ${categoryIconBadge(c, 38)}
        <div class="info">
          <div class="desc">${escapeHtml(d.plan.name)}</div>
          <div class="meta">${escapeHtml(progressLabel(d.plan))} · ${fmt(d.paidTx ? d.paidTx.amount : d.plan.monthlyAmount)} · ${escapeHtml(dueRuleLabel(d.plan.dueRule, { short: true }))}</div>
        </div>
        <span class="bill-badge ${badge.cls}">${escapeHtml(badge.text)}</span>
      </div>`;
      })
      .join("")}
  </div>`;
}
