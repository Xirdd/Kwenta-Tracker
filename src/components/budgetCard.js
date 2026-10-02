import "../customCategories.css";
import { DATA, monthTx, budgetFor, hasOwnSecondBudget } from "../state.js";
import { catInfo, categoryIconBadge } from "../categories.js";
import { fmt, escapeHtml } from "../format.js";

const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const EDIT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

// One small pill per half: "1–15  ₱ [ 5000 ]" / "16–end  ₱ [ 4000 ]". The pill
// for the half currently being viewed gets a gold ring so it's obvious which
// limit the progress bar below is measuring against. The 2nd-half input shows
// the 1st-half limit as its placeholder while it has no limit of its own.
function limitPill(catId, half, value, placeholder, active) {
  const label = half === 1 ? "1–15" : "16–end";
  return `
  <div class="budget-input-wrap" style="flex:1;min-width:0;width:auto;margin-bottom:0;border:1.5px solid ${active ? "var(--gold)" : "transparent"};">
    <span style="font-size:10.5px;font-weight:700;color:var(--ink-soft);margin-right:4px;white-space:nowrap;">${label}</span>
    <span>₱</span>
    <input type="number" inputmode="decimal" class="budgetInput" data-cat="${catId}" data-half="${half}" placeholder="${placeholder || 0}" value="${value}" style="flex:1;min-width:0;width:100%;"/>
  </div>`;
}

// Monthly mode has no second half — one limit for the whole month, bound to half=1.
function singleLimitInput(catId, value) {
  return `
  <div class="budget-input-wrap" style="flex:1;min-width:0;width:auto;margin-bottom:0;">
    <span>₱</span>
    <input type="number" inputmode="decimal" class="budgetInput" data-cat="${catId}" data-half="1" placeholder="0" value="${value}" style="flex:1;min-width:0;width:100%;"/>
  </div>`;
}

// `c` is a category object from visibleCategories(). Custom ones get an edit
// pencil (data-edit-cat) that opens the Add/Edit form.
export function renderBudgetCard(c, { spent, isHalfMonth, viewedHalf }) {
  const first = Number(DATA.budgets[c.id]) || 0;
  const hasSecond = hasOwnSecondBudget(c.id);
  const limit = budgetFor(c.id);
  const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
  const over = limit > 0 && spent > limit;

  return `
  <div class="budget-row" data-cat-row="${c.id}">
    <div class="budget-header" data-toggle="${c.id}">
      <div class="budget-name">${categoryIconBadge(c, 32)}${escapeHtml(c.label)}</div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${c.custom ? `<button type="button" class="icon-ghost-btn" data-edit-cat="${c.id}" title="Edit" aria-label="Edit ${escapeHtml(c.label)}">${EDIT_ICON}</button>` : ""}
        <span class="budget-chevron">${CHEVRON_ICON}</span>
      </div>
    </div>
    <div class="budget-detail">
      <div class="budget-detail-inner">
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          ${
            isHalfMonth
              ? limitPill(c.id, 1, first || "", 0, viewedHalf === 1) +
                limitPill(
                  c.id,
                  2,
                  hasSecond ? DATA.budgetsSecond[c.id] : "",
                  first,
                  viewedHalf === 2,
                )
              : singleLimitInput(c.id, first || "")
          }
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${limit ? Math.max(pct, 2) : 0}%;background:${over ? "var(--coral)" : c.color}"></div></div>
        <div class="budget-meta ${over ? "over" : ""}">${fmt(spent)} of ${limit ? fmt(limit) : "no limit set"}${over ? " · over budget" : ""}</div>
      </div>
    </div>
  </div>`;
}

// Re-measures one card against whichever limit applies to the viewed half,
// without a full re-render (which would drop input focus mid-typing).
export function refreshBudgetCard(row, cat) {
  const spent = monthTx("expense")
    .filter((x) => x.category === cat)
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const limit = budgetFor(cat);
  const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
  const over = limit > 0 && spent > limit;

  const fill = row.querySelector(".bar-fill");
  fill.style.width = (limit ? Math.max(pct, 2) : 0) + "%";
  fill.style.background = over ? "var(--coral)" : catInfo(cat).color;
  const meta = row.querySelector(".budget-meta");
  meta.textContent = `${fmt(spent)} of ${limit ? fmt(limit) : "no limit set"}${over ? " · over budget" : ""}`;
  meta.classList.toggle("over", over);

  // While the 2nd half has no limit of its own, its placeholder mirrors the
  // 1st-half value it's inheriting — keep that in step as the 1st is edited.
  const second = row.querySelector('.budgetInput[data-half="2"]');
  if (second && !hasOwnSecondBudget(cat)) {
    second.placeholder = String(Number(DATA.budgets[cat]) || 0);
  }
}
