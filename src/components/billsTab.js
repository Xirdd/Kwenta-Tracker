import { state, DATA } from "../state.js";
import { catInfo, categoryIconBadge } from "../categories.js";
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

  // Bills are month-scoped, not period-scoped (see bills.js's header for
  // why) — so viewing either half of the same month shows the same bills
  // and the same paid/unpaid status either way. This is the month-only
  // portion of the currently viewed period key, e.g. "2026-09-1" -> "2026-09".
  const viewedMonthKey = monthPortionOf(state.monthKey);
  const isRealCurrentMonth = viewedMonthKey === currentRealMonthKey();

  const sorted = bills.slice().sort((a, b) => {
    const aPaid = !!findPaymentTx(a.id, viewedMonthKey);
    const bPaid = !!findPaymentTx(b.id, viewedMonthKey);
    if (aPaid !== bPaid) return aPaid ? 1 : -1; // unpaid first
    return a.dueDay - b.dueDay;
  });

  const rows = sorted
    .map((bill) => {
      const c = catInfo(bill.category);
      const paidTx = findPaymentTx(bill.id, viewedMonthKey);
      const due = dueDateStr(viewedMonthKey, bill.dueDay);

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
    <div class="bill-row" data-bill="${bill.id}" data-month="${viewedMonthKey}">
      ${categoryIconBadge(c, 36)}
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
