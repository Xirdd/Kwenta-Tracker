import {
  DATA,
  state,
  monthTx,
  saveData,
  budgetFor,
  halfOfKey,
  hasOwnSecondBudget,
} from "../state.js";
import { CATEGORIES, catInfo, categoryIconBadge } from "../categories.js";
import { fmt } from "../format.js";
import { isCloudMode, cloudUpsertBudget } from "../sync.js";
import { cloudSetBudgetSecond } from "../budgetLimitsCloud.js";
import { notifySyncError } from "../toast.js";

const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

// One small pill per half: "1–15  ₱ [ 5000 ]" / "16–end  ₱ [ 4000 ]". The pill
// for the half currently being viewed gets a gold ring so it's obvious which
// limit the progress bar below is measuring against. The 2nd-half input shows
// the 1st-half limit as its placeholder while it has no limit of its own —
// that's the value it's inheriting.
function limitPill(catId, half, value, placeholder, active) {
  const label = half === 1 ? "1–15" : "16–end";
  return `
  <div class="budget-input-wrap" style="margin-bottom:0;${active ? "box-shadow:0 0 0 1.5px var(--gold);" : ""}">
    <span style="font-size:10.5px;font-weight:700;color:var(--ink-soft);margin-right:4px;">${label}</span>
    <span>₱</span>
    <input type="number" inputmode="decimal" class="budgetInput" data-cat="${catId}" data-half="${half}" placeholder="${placeholder || 0}" value="${value}" style="width:64px;"/>
  </div>`;
}

export function renderBudgets() {
  const exp = monthTx("expense");
  const spentByCat = {};
  exp.forEach((e) => {
    spentByCat[e.category] =
      (spentByCat[e.category] || 0) + Number(e.amount || 0);
  });
  const viewedHalf = halfOfKey(state.monthKey);
  const totalBudget = CATEGORIES.reduce((s, c) => s + budgetFor(c.id), 0);
  const totalSpent = exp.reduce((s, e) => s + Number(e.amount || 0), 0);

  return `
  <div class="section-title">Budgets <span class="sub">a limit for each half-month</span></div>
  ${
    totalBudget > 0
      ? `
    <div class="budget-summary">
      <span>Total budgeted</span>
      <span>${fmt(totalSpent)} <span class="of">of ${fmt(totalBudget)}</span></span>
    </div>`
      : ""
  }
  <div class="list budget-list">
    ${CATEGORIES.map((c) => {
      const first = Number(DATA.budgets[c.id]) || 0;
      const hasSecond = hasOwnSecondBudget(c.id);
      const limit = budgetFor(c.id);
      const spent = spentByCat[c.id] || 0;
      const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
      const over = limit > 0 && spent > limit;
      return `
      <div class="budget-row" data-cat-row="${c.id}">
        <div class="budget-header" data-toggle="${c.id}">
          <div class="budget-name">${categoryIconBadge(c, 32)}${c.label}</div>
          <span class="budget-chevron">${CHEVRON_ICON}</span>
        </div>
        <div class="budget-detail">
          <div class="budget-detail-inner">
            <div style="display:flex;gap:8px;margin-bottom:12px;">
              ${limitPill(c.id, 1, first || "", 0, viewedHalf === 1)}
              ${limitPill(c.id, 2, hasSecond ? DATA.budgetsSecond[c.id] : "", first, viewedHalf === 2)}
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${limit ? Math.max(pct, 2) : 0}%;background:${over ? "var(--coral)" : c.color}"></div></div>
            <div class="budget-meta ${over ? "over" : ""}">${fmt(spent)} of ${limit ? fmt(limit) : "no limit set"}${over ? " · over budget" : ""}</div>
          </div>
        </div>
      </div>`;
    }).join("")}
  </div>
  `;
}

// Cloud writes are debounced per (category, half): every keystroke still
// updates the screen and the local copy instantly, but the network call only
// fires once typing pauses. Sending one per keystroke let responses land out
// of order (typing 500 could leave "50" in the cloud).
const cloudTimers = {};
function scheduleCloudWrite(cat, half) {
  if (!isCloudMode()) return;
  const key = `${cat}:${half}`;
  clearTimeout(cloudTimers[key]);
  cloudTimers[key] = setTimeout(() => {
    if (half === 1) {
      cloudUpsertBudget(cat, DATA.budgets[cat]).catch((err) =>
        notifySyncError(err),
      );
    } else {
      cloudSetBudgetSecond(cat, DATA.budgetsSecond[cat]).catch((err) =>
        notifySyncError(err),
      );
    }
  }, 400);
}

// Re-measures one row against whichever limit applies to the viewed half,
// without a full re-render (which would drop input focus mid-typing).
function refreshRow(row, cat) {
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

// Wires the limit inputs and the tap-to-reveal toggle on each row's header.
export function attachBudgetEvents() {
  document.querySelectorAll(".budgetInput").forEach((inp) => {
    inp.oninput = (e) => {
      const cat = inp.dataset.cat;
      const half = Number(inp.dataset.half);
      const val = e.target.value === "" ? undefined : Number(e.target.value);

      if (half === 1) {
        // Clearing the 1st-half box normally removes the whole cloud row —
        // which would silently take a separate 2nd-half limit with it. So
        // while one exists, store 0 ("no limit") instead of deleting.
        DATA.budgets[cat] =
          val === undefined && hasOwnSecondBudget(cat) ? 0 : val;
      } else if (val === undefined) {
        delete DATA.budgetsSecond[cat]; // blank = inherit the 1st-half limit again
      } else {
        DATA.budgetsSecond[cat] = val; // an explicit 0 means "no limit this half"
      }

      saveData();
      scheduleCloudWrite(cat, half);
      refreshRow(inp.closest(".budget-row"), cat);
    };
    // Typing shouldn't collapse the row it's inside — only the header toggles it.
    inp.onclick = (e) => e.stopPropagation();
  });

  document.querySelectorAll("[data-toggle]").forEach((header) => {
    header.onclick = () => {
      const row = header.closest(".budget-row");
      row.classList.toggle("open");
    };
  });
}
