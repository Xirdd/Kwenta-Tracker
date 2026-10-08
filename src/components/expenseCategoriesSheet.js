import "./optionList.css";
import { state, DATA, monthTx } from "../state.js";
import {
  allExpenseCategories,
  LEGACY_CATEGORIES,
  categoryIconBadge,
} from "../categories.js";
import { escapeHtml } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { openCategoryForm } from "./categoryFormSheet.js";

// The Expenses tab's "Categories" menu — a bottom sheet with two modes:
//
//  Filter     pick one category (or All) to filter the list. Counts are for the
//             period on screen. Tapping a row applies it and closes the sheet.
//  Customize  create, edit and delete your own categories (name, color, icon,
//             optional budget limit) — the same form the Budgets tab uses.
//             Built-in categories are listed but can't be edited.
//
// It replaces the row of category chips that used to sit on the page itself.

const CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const PENCIL = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const PLUS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

let onFilterChange = () => {};

// opts.onFilterChange(categoryId | null) is called after a row is chosen.
export function openExpenseCategoriesSheet(opts = {}) {
  onFilterChange = opts.onFilterChange || (() => {});
  renderFilter();
}

function categoryRows() {
  const counts = {};
  monthTx("expense").forEach((t) => {
    counts[t.category] = (counts[t.category] || 0) + 1;
  });
  const list = [...allExpenseCategories()];
  // The retired combined "Food & Groceries" category only appears while
  // something this period is still filed under it.
  LEGACY_CATEGORIES.forEach((c) => {
    if (counts[c.id]) list.push(c);
  });
  return { list, counts };
}

function renderFilter() {
  const { list, counts } = categoryRows();
  const selected = state.expenseFilters.category || "";
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  const row = (id, leading, label, count) => `
    <button type="button" class="opt-row ${id === selected ? "selected" : ""}" role="radio" aria-checked="${id === selected}" data-cat="${escapeHtml(id)}">
      ${leading}
      <span class="opt-text"><span class="opt-label">${escapeHtml(label)}</span></span>
      <span class="opt-count" aria-label="${count} this period">${count}</span>
      <span class="opt-check">${CHECK}</span>
    </button>`;

  openModal(`
    <div class="grabber"></div>
    <div class="sheet-head">
      <h3>Categories</h3>
      <button type="button" class="sheet-link-btn" id="catCustomizeBtn">Customize</button>
    </div>
    <p class="auth-message">Show only one category. Counts are for the period you're viewing.</p>
    <div class="opt-list" role="radiogroup" aria-label="Filter by category">
      ${row("", `<span class="opt-sym opt-sym-all" aria-hidden="true">All</span>`, "All categories", total)}
      ${list.map((c) => row(c.id, categoryIconBadge(c, 36), c.label, counts[c.id] || 0)).join("")}
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="catCloseBtn">Close</button>
    </div>
  `);

  document.getElementById("catCloseBtn").onclick = closeModal;
  document.getElementById("catCustomizeBtn").onclick = renderManage;
  document.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.cat || null;
      closeModal();
      onFilterChange(id);
    };
  });
}

function renderManage() {
  const { list, counts } = categoryRows();

  openModal(`
    <div class="grabber"></div>
    <div class="sheet-head">
      <h3>Customize categories</h3>
      <button type="button" class="sheet-link-btn" id="catBackBtn">Done</button>
    </div>
    <p class="auth-message">Add your own categories with a custom icon and color. Built-in ones can't be edited.</p>
    <div class="opt-list">
      ${list
        .map(
          (c) => `
        <div class="opt-row static">
          ${categoryIconBadge(c, 36)}
          <span class="opt-text">
            <span class="opt-label">${escapeHtml(c.label)}</span>
            <span class="opt-sub">${c.custom ? "Custom" : "Built-in"}${counts[c.id] ? ` · ${counts[c.id]} this period` : ""}</span>
          </span>
          ${c.custom ? `<button type="button" class="opt-edit" data-edit-cat="${escapeHtml(c.id)}" aria-label="Edit ${escapeHtml(c.label)}">${PENCIL}</button>` : ""}
        </div>`,
        )
        .join("")}
    </div>
    <button type="button" class="btn btn-primary" id="catNewBtn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;">${PLUS}New category</button>
  `);

  document.getElementById("catBackBtn").onclick = renderFilter;
  document.getElementById("catNewBtn").onclick = () =>
    openCategoryForm(null, {}, renderManage);
  document.querySelectorAll("[data-edit-cat]").forEach((btn) => {
    btn.onclick = () => {
      const raw = DATA.customCategories.find(
        (c) => c.id === btn.dataset.editCat,
      );
      if (raw) openCategoryForm(raw, {}, renderManage);
    };
  });
}
