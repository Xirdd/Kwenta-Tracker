import { state, DATA } from "../state.js";
import { catInfo } from "../categories.js";
import { fmt, escapeHtml } from "../format.js";
import {
  findPaymentTx,
  dueDateStr,
  daysUntil,
  currentRealMonthKey,
  ordinalSuffix,
  billCategoryLabel,
} from "../bills.js";

export function renderBills() {
  const bills = DATA.bills;

  if (bills.length === 0) {
    return `
    <div class="section-title">Bills <span class="sub">due each month</span></div>
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>No bills tracked yet.<br/>Tap + to add Meralco, water, internet, or anything with a due date.</p>
    </div>`;
  }

  const isRealCurrentMonth = state.monthKey === currentRealMonthKey();

  const sorted = bills.slice().sort((a, b) => {
    const aPaid = !!findPaymentTx(a.id, state.monthKey);
    const bPaid = !!findPaymentTx(b.id, state.monthKey);
    if (aPaid !== bPaid) return aPaid ? 1 : -1; // unpaid first
    return a.dueDay - b.dueDay;
  });

  const rows = sorted
    .map((bill) => {
      const c = catInfo(bill.category);
      const paidTx = findPaymentTx(bill.id, state.monthKey);
      const due = dueDateStr(state.monthKey, bill.dueDay);

      let badge, badgeClass;
      if (paidTx) {
        badge = "Paid";
        badgeClass = "paid";
      } else if (isRealCurrentMonth) {
        const d = daysUntil(due);
        if (d < 0) {
          badge = `${Math.abs(d)}d overdue`;
          badgeClass = "overdue";
        } else if (d === 0) {
          badge = "Due today";
          badgeClass = "soon";
        } else if (d <= 3) {
          badge = `Due in ${d}d`;
          badgeClass = "soon";
        } else {
          badge = `Due in ${d}d`;
          badgeClass = "later";
        }
      } else {
        badge = "Not paid";
        badgeClass = "later";
      }

      const amountLabel = paidTx
        ? fmt(paidTx.amount)
        : bill.estimatedAmount
          ? `~${fmt(bill.estimatedAmount)}`
          : "—";

      return `
    <div class="bill-row" data-bill="${bill.id}" data-month="${state.monthKey}">
      <span class="chip" style="background:${c.color}"></span>
      <div class="info">
        <div class="desc">${escapeHtml(bill.name)}</div>
        <div class="meta">${escapeHtml(billCategoryLabel(bill, c.label))} · due on the ${bill.dueDay}${ordinalSuffix(bill.dueDay)}</div>
      </div>
      <div class="bill-right">
        <span class="bill-badge ${badgeClass}">${badge}</span>
        <span class="bill-amount">${amountLabel}</span>
      </div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Bills <span class="sub">${bills.length} tracked</span></div>
  <div class="list bill-list">${rows}</div>
  `;
}
