import { state, monthTx, monthLabel } from "../state.js";
import { catInfo } from "../categories.js";
import { fmt, formatDate, escapeHtml } from "../format.js";

export function renderExpenses() {
  const items = monthTx("expense").sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );
  return `
  <div class="section-title">Expenses <span class="sub">${items.length} ${items.length === 1 ? "entry" : "entries"}</span></div>
  ${
    items.length === 0
      ? `
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>Nothing logged for ${monthLabel(state.monthKey)}.<br/>Tap + to add an expense.</p>
    </div>`
      : `
    <div class="list">
      ${items
        .map((tx) => {
          const c = catInfo(tx.category);
          return `
        <div class="row" data-edit="${tx.id}" data-type="expense">
          <span class="chip" style="background:${c.color}"></span>
          <div class="info">
            <div class="desc">${escapeHtml(tx.desc || c.label)}</div>
            <div class="meta">${c.label} · ${formatDate(tx.date)}</div>
          </div>
          <div class="amt expense">-${fmt(tx.amount)}</div>
        </div>`;
        })
        .join("")}
    </div>`
  }
  `;
}
