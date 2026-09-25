import {
  DATA,
  state,
  monthTx,
  saveData,
  budgetFor,
  halfOfKey,
  hasOwnSecondBudget,
} from "../state.js";
import {
  catInfo,
  categoryIconBadge,
  allExpenseCategories,
  CUSTOM_CATEGORY_COLORS,
} from "../categories.js";
import { fmt, escapeHtml } from "../format.js";
import { isCloudMode, cloudUpsertBudget } from "../sync.js";
import { cloudSetBudgetSecond } from "../budgetLimitsCloud.js";
import { notifySyncError } from "../toast.js";
import {
  createCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
} from "../customCategories.js";
import "../customCategories.css";
import { openModal, closeModal } from "./modal.js";

let onChange = () => {};

// Called once from main.js (initBudgetsSheet(render)) — lets the custom-
// category create/edit/delete modal below trigger a re-render after saving,
// the same pattern goalSheet.js/loanSheet.js/billSheet.js already use.
export function initBudgetsSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const EDIT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const PLUS_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

// One small pill per half: "1–15  ₱ [ 5000 ]" / "16–end  ₱ [ 4000 ]". The pill
// for the half currently being viewed gets a gold ring so it's obvious which
// limit the progress bar below is measuring against. The 2nd-half input shows
// the 1st-half limit as its placeholder while it has no limit of its own —
// that's the value it's inheriting.
function limitPill(catId, half, value, placeholder, active) {
  const label = half === 1 ? "1–15" : "16–end";
  // Equal-width pills that share the row (flex:1). The active ring is a real
  // border rather than a box-shadow: the collapsible row is overflow:hidden,
  // so a shadow ring got its top and sides sliced off.
  return `
  <div class="budget-input-wrap" style="flex:1;min-width:0;width:auto;margin-bottom:0;border:1.5px solid ${active ? "var(--gold)" : "transparent"};">
    <span style="font-size:10.5px;font-weight:700;color:var(--ink-soft);margin-right:4px;white-space:nowrap;">${label}</span>
    <span>₱</span>
    <input type="number" inputmode="decimal" class="budgetInput" data-cat="${catId}" data-half="${half}" placeholder="${placeholder || 0}" value="${value}" style="flex:1;min-width:0;width:100%;"/>
  </div>`;
}

export function renderBudgets() {
  const cats = allExpenseCategories();
  const exp = monthTx("expense");
  const spentByCat = {};
  exp.forEach((e) => {
    spentByCat[e.category] =
      (spentByCat[e.category] || 0) + Number(e.amount || 0);
  });
  const viewedHalf = halfOfKey(state.monthKey);
  const totalBudget = cats.reduce((s, c) => s + budgetFor(c.id), 0);
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
    ${cats
      .map((c) => {
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
          <div style="display:flex;align-items:center;gap:10px;">
            ${c.custom ? `<button type="button" class="icon-ghost-btn" data-edit-cat="${c.id}" title="Edit">${EDIT_ICON}</button>` : ""}
            <span class="budget-chevron">${CHEVRON_ICON}</span>
          </div>
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
      })
      .join("")}
  </div>
  <button type="button" class="btn btn-ghost" id="addCustomCatBtn" style="width:100%;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;">${PLUS_ICON}Add a custom budget category</button>
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

// Wires the limit inputs, the tap-to-reveal toggle, and the custom-category
// add/edit controls.
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

  document.querySelectorAll("[data-edit-cat]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation(); // don't also toggle the row open/closed
      const cat = DATA.customCategories.find(
        (c) => c.id === btn.dataset.editCat,
      );
      if (cat) openCategoryForm(cat);
    };
  });

  const addBtn = document.getElementById("addCustomCatBtn");
  if (addBtn) addBtn.onclick = () => openCategoryForm(null);
}

function colorSwatchRow(selected) {
  return `
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
    ${CUSTOM_CATEGORY_COLORS.map(
      (hex) => `
      <button type="button" class="color-swatch-btn ${hex === selected ? "selected" : ""}" data-color="${hex}" style="background:${hex};" aria-label="${hex}"></button>
    `,
    ).join("")}
  </div>`;
}

function openCategoryForm(cat, error) {
  const isEdit = !!cat;
  let chosenColor = cat ? cat.color : CUSTOM_CATEGORY_COLORS[0];

  openModal(`
    <div class="grabber"></div>
    <h3>${isEdit ? "Edit budget category" : "New budget category"}</h3>
    <div class="field">
      <label>Name</label>
      <input id="ccLabel" type="text" placeholder="e.g. Pet care, Tuition" value="${escapeHtml(cat?.label || "")}"/>
    </div>
    <div class="field">
      <label>Color</label>
      <div id="ccColorRow">${colorSwatchRow(chosenColor)}</div>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      ${isEdit ? `<button class="btn btn-danger" id="ccDeleteBtn">Delete</button>` : ""}
      <button class="btn btn-ghost" id="ccCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="ccSaveBtn">Save</button>
    </div>
  `);

  document.querySelectorAll("#ccColorRow .color-swatch-btn").forEach((btn) => {
    btn.onclick = () => {
      chosenColor = btn.dataset.color;
      document
        .querySelectorAll("#ccColorRow .color-swatch-btn")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    };
  });

  document.getElementById("ccCancelBtn").onclick = closeModal;

  document.getElementById("ccSaveBtn").onclick = () => {
    const label = document.getElementById("ccLabel").value.trim();
    if (!label) {
      openCategoryForm(cat, "Give this category a name.");
      return;
    }
    // "Others" is a reserved fallback label everywhere in the app
    // (catInfo()'s catch-all) — a same-named custom category would be
    // confusing right next to it.
    if (label.toLowerCase() === "others") {
      openCategoryForm(cat, "That name is reserved — try something else.");
      return;
    }

    if (isEdit) updateCustomCategory(cat, { label, color: chosenColor });
    else createCustomCategory({ label, color: chosenColor });

    closeModal();
    onChange();
  };

  if (isEdit) {
    document.getElementById("ccDeleteBtn").onclick = () =>
      confirmDeleteCategory(cat);
  }
}

function confirmDeleteCategory(cat) {
  openModal(`
    <div class="grabber"></div>
    <h3>Delete "${escapeHtml(cat.label)}"?</h3>
    <p class="auth-message">Its budget limits go with it. Expenses already logged under it stay in your history, listed under "Others" from now on.</p>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="ccKeepBtn">Keep it</button>
      <button class="btn btn-danger" id="ccConfirmDeleteBtn">Delete</button>
    </div>
  `);
  document.getElementById("ccKeepBtn").onclick = () => openCategoryForm(cat);
  document.getElementById("ccConfirmDeleteBtn").onclick = () => {
    deleteCustomCategory(cat.id);
    closeModal();
    onChange();
  };
}
