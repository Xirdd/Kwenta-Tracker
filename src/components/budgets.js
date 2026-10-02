import {
  DATA,
  state,
  monthTx,
  saveData,
  halfOfKey,
  budgetFor,
  hasOwnSecondBudget,
  periodKeyHasHalf,
} from "../state.js";
import { fmt } from "../format.js";
import { isCloudMode, cloudUpsertBudget } from "../sync.js";
import { cloudSetBudgetSecond } from "../budgetLimitsCloud.js";
import { notifySyncError } from "../toast.js";
import { visibleCategories, budgetCategoryPool } from "../budgetView.js";
import { renderBudgetCard, refreshBudgetCard } from "./budgetCard.js";
import {
  initBudgetCategoryPicker,
  openBudgetCategoryPicker,
} from "./budgetCategoryPicker.js";
import {
  initCategoryFormSheet,
  openCategoryForm,
} from "./categoryFormSheet.js";

// Called once from main.js (initBudgetsSheet(render)). Fans the re-render
// callback out to the sheets this tab opens, so main.js needs no change.
export function initBudgetsSheet(rerenderCallback) {
  initBudgetCategoryPicker(rerenderCallback);
  initCategoryFormSheet(rerenderCallback);
}

const PLUS_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SLIDERS_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`;

function spentByCategory() {
  const spent = {};
  monthTx("expense").forEach((e) => {
    spent[e.category] = (spent[e.category] || 0) + Number(e.amount || 0);
  });
  return spent;
}

// Totals count ONLY the categories currently shown, so "budgeted" and
// "spent" always describe the same set of cards.
function summaryTotals(cats) {
  const spent = spentByCategory();
  return {
    totalBudget: cats.reduce((s, c) => s + budgetFor(c.id), 0),
    totalSpent: cats.reduce((s, c) => s + (spent[c.id] || 0), 0),
  };
}

function renderEmptyState() {
  return `
  <div class="empty-state">
    <div class="glyph">₱</div>
    <p>No budget categories selected.<br/>Choose the ones you want to track.</p>
    <button type="button" class="btn btn-primary" id="selectCatsBtn" style="margin-top:18px;width:auto;padding:14px 28px;">Select Categories</button>
  </div>`;
}

export function renderBudgets() {
  const cats = visibleCategories();
  const { presets, others } = budgetCategoryPool();
  const poolSize = presets.length + others.length;
  const spentByCat = spentByCategory();
  const { totalBudget, totalSpent } = summaryTotals(cats);
  const viewedHalf = halfOfKey(state.monthKey);
  const isHalfMonth = periodKeyHasHalf(state.monthKey);

  const cards = cats
    .map((c) =>
      renderBudgetCard(c, {
        spent: spentByCat[c.id] || 0,
        isHalfMonth,
        viewedHalf,
      }),
    )
    .join("");

  return `
  <div class="section-title">Budgets <span class="sub">${isHalfMonth ? "a limit for each half-month" : "a limit each month"}</span></div>
  <div class="budget-toolbar">
    <span class="budget-toolbar-count">Showing <strong>${cats.length}</strong> of ${poolSize} categories</span>
    <button type="button" class="budget-customize-btn" id="manageCatsBtn">${SLIDERS_ICON}Customize</button>
  </div>
  ${
    cats.length === 0
      ? renderEmptyState()
      : `
  <div class="budget-summary" id="budgetSummary" style="display:${totalBudget > 0 ? "flex" : "none"};">
    <span>Total budgeted</span>
    <span><span id="budgetSummarySpent">${fmt(totalSpent)}</span> <span class="of">of <span id="budgetSummaryLimit">${fmt(totalBudget)}</span></span></span>
  </div>
  <div class="list budget-list">${cards}</div>`
  }
  <button type="button" class="btn btn-ghost" id="addCustomCatBtn" style="width:100%;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;">${PLUS_ICON}Add a custom budget category</button>
  `;
}

// Cloud writes are debounced per (category, half): every keystroke still
// updates the screen and the local copy instantly, but the network call only
// fires once typing pauses (otherwise responses can land out of order).
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

// Keeps the "Total budgeted" strip in step with typing, without a re-render.
function refreshSummary() {
  const el = document.getElementById("budgetSummary");
  if (!el) return;
  const { totalBudget, totalSpent } = summaryTotals(visibleCategories());
  el.style.display = totalBudget > 0 ? "flex" : "none";
  document.getElementById("budgetSummarySpent").textContent = fmt(totalSpent);
  document.getElementById("budgetSummaryLimit").textContent = fmt(totalBudget);
}

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
      refreshBudgetCard(inp.closest(".budget-row"), cat);
      refreshSummary();
    };
    // Typing shouldn't collapse the card it's inside — only the header toggles it.
    inp.onclick = (e) => e.stopPropagation();
  });

  document.querySelectorAll("[data-toggle]").forEach((header) => {
    header.onclick = () =>
      header.closest(".budget-row").classList.toggle("open");
  });

  // Edit pencil on custom cards -> the same form used for creating.
  document.querySelectorAll("[data-edit-cat]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation(); // don't also toggle the card open/closed
      const cat = DATA.customCategories.find(
        (c) => c.id === btn.dataset.editCat,
      );
      if (cat) openCategoryForm(cat);
    };
  });

  const manageBtn = document.getElementById("manageCatsBtn");
  if (manageBtn) manageBtn.onclick = openBudgetCategoryPicker;
  const selectBtn = document.getElementById("selectCatsBtn");
  if (selectBtn) selectBtn.onclick = openBudgetCategoryPicker;

  const addBtn = document.getElementById("addCustomCatBtn");
  if (addBtn) addBtn.onclick = () => openCategoryForm(null);
}
