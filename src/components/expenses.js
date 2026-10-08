import "./expenseCategories.css";
import { state, DATA, monthTx, monthLabel } from "../state.js";
import { catInfo, categoryIconBadge } from "../categories.js";
import { fmt, formatDate, escapeHtml } from "../format.js";
import { addPesos } from "../money.js";
import { openForm } from "./sheet.js";
import { openExpenseCategoriesSheet } from "./expenseCategoriesSheet.js";

const FILTER_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>`;

function isFiltering() {
  return (
    state.expenseFilters.query.trim() !== "" || !!state.expenseFilters.category
  );
}

function filteredExpenses() {
  const { query, category } = state.expenseFilters;
  let items = monthTx("expense");
  if (category) items = items.filter((tx) => tx.category === category);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    items = items.filter((tx) => {
      const desc = (tx.desc || "").toLowerCase();
      const label = catInfo(tx.category).label.toLowerCase();
      const tagsMatch = (tx.tags || []).some((t) =>
        t.toLowerCase().includes(q),
      );
      return desc.includes(q) || label.includes(q) || tagsMatch;
    });
  }
  return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function renderExpenses() {
  const all = monthTx("expense");
  const items = filteredExpenses();
  const total = all.reduce((s, t) => addPesos(s, t.amount), 0);
  const avgPerEntry = all.length ? total / all.length : 0;

  return `
  <div class="section-title">Expenses <span class="sub">${all.length} ${all.length === 1 ? "entry" : "entries"}</span></div>
  ${
    all.length > 0
      ? `
  <div class="stat-strip">
    <div class="stat-chip">
      <div class="label">Total this period</div>
      <div class="value" style="color:var(--coral);">${fmt(total)}</div>
    </div>
    <div class="stat-chip">
      <div class="label">Average per entry</div>
      <div class="value">${fmt(avgPerEntry)}</div>
    </div>
  </div>`
      : ""
  }
  ${renderToolbar()}
  <div id="expenseListWrap">${renderExpenseList(items, all.length)}</div>
  `;
}

// Search box + one "Categories" button. Categories are hidden until asked for:
// the old chip row overlapped on narrow phones. A small pill under the toolbar
// shows (and clears) the active category filter.
function renderToolbar() {
  const { query, category } = state.expenseFilters;
  const active = category ? catInfo(category) : null;
  return `
  <div class="expense-toolbar">
    <div class="expense-search">
      <input id="expenseSearchInput" type="search" placeholder="Search expenses…" aria-label="Search expenses" value="${escapeHtml(query)}"/>
    </div>
    <button type="button" class="expense-cat-btn ${active ? "active" : ""}" id="expenseCategoriesBtn" aria-haspopup="dialog">
      ${FILTER_ICON}<span>Categories</span>
    </button>
  </div>
  ${
    active
      ? `
  <div class="active-filter">
    <span class="active-filter-label">${categoryIconBadge(active, 22)}<span>${escapeHtml(active.label)}</span></span>
    <button type="button" id="clearCategoryFilter" aria-label="Clear category filter">✕</button>
  </div>`
      : ""
  }`;
}

function renderExpenseList(items, totalCount) {
  if (totalCount === 0) {
    return `
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>Nothing logged for ${monthLabel(state.monthKey)}.<br/>Tap the + button to add an expense.</p>
    </div>`;
  }
  if (items.length === 0) {
    return `
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>No expenses match${isFiltering() ? " your search" : ""}.<br/>Try a different keyword or category.</p>
    </div>`;
  }
  return `
  <div class="list">
    ${items
      .map((tx) => {
        const c = catInfo(tx.category);
        return `
      <div class="row" data-edit="${tx.id}" data-type="expense">
        ${categoryIconBadge(c, 36)}
        <div class="info">
          <div class="desc">${escapeHtml(tx.desc || c.label)}${tx.recurringId ? ' <span class="recur-badge" title="Repeats monthly">↻</span>' : ""}</div>
          <div class="meta">${escapeHtml(c.label)} · ${formatDate(tx.date)}</div>
          ${tx.tags && tx.tags.length ? `<div class="tag-pills">${tx.tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="amt expense">-${fmt(tx.amount)}</div>
      </div>`;
      })
      .join("")}
  </div>`;
}

// Re-renders just this tab's panel (the search box keeps its text because the
// value is rendered from state).
function rerenderPanel() {
  const panel = document.querySelector(".content-panel");
  if (panel) {
    panel.innerHTML = renderExpenses();
    attachExpenseEvents();
  }
}

function setCategoryFilter(id) {
  state.expenseFilters.category = id || null;
  rerenderPanel();
}

export function attachExpenseEvents() {
  const searchInput = document.getElementById("expenseSearchInput");
  if (searchInput) {
    // Live filter as you type, without losing focus (only the list re-renders, not the whole tab).
    searchInput.oninput = (e) => {
      state.expenseFilters.query = e.target.value;
      const wrap = document.getElementById("expenseListWrap");
      if (wrap) {
        wrap.innerHTML = renderExpenseList(
          filteredExpenses(),
          monthTx("expense").length,
        );
        wireRows();
      }
    };
  }

  const catBtn = document.getElementById("expenseCategoriesBtn");
  if (catBtn) {
    catBtn.onclick = () =>
      openExpenseCategoriesSheet({ onFilterChange: setCategoryFilter });
  }

  const clearBtn = document.getElementById("clearCategoryFilter");
  if (clearBtn) clearBtn.onclick = () => setCategoryFilter(null);

  wireRows();
}

function wireRows() {
  document.querySelectorAll("#expenseListWrap [data-edit]").forEach((row) => {
    row.onclick = () => {
      const tx = DATA.transactions.find((t) => t.id === row.dataset.edit);
      if (tx) openForm("expense", tx);
    };
  });
}
