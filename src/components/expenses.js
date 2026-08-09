import { state, DATA, monthTx, monthLabel } from "../state.js";
import { CATEGORIES, catInfo } from "../categories.js";
import { fmt, formatDate, escapeHtml } from "../format.js";
import { openForm } from "./sheet.js";

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

// Only show filter chips for categories actually used this month, to keep it relevant.
function presentCategories() {
  const ids = new Set(monthTx("expense").map((tx) => tx.category));
  return CATEGORIES.filter((c) => ids.has(c.id));
}

export function renderExpenses() {
  const all = monthTx("expense");
  const items = filteredExpenses();
  const cats = presentCategories();

  return `
  <div class="section-title">Expenses <span class="sub">${all.length} ${all.length === 1 ? "entry" : "entries"}</span></div>
  ${all.length > 0 ? renderSearchBar(cats) : ""}
  <div id="expenseListWrap">${renderExpenseList(items, all.length)}</div>
  `;
}

function renderSearchBar(cats) {
  const { query, category } = state.expenseFilters;
  return `
  <div class="expense-search">
    <input id="expenseSearchInput" type="search" placeholder="Search expenses…" value="${escapeHtml(query)}"/>
  </div>
  ${
    cats.length > 0
      ? `
  <div class="cat-filter-row">
    <button class="cat-filter-chip ${!category ? "active" : ""}" data-filter-cat="">All</button>
    ${cats.map((c) => `<button class="cat-filter-chip ${category === c.id ? "active" : ""}" data-filter-cat="${c.id}"><span class="chip" style="background:${c.color}"></span>${c.label}</button>`).join("")}
  </div>`
      : ""
  }
  `;
}

function renderExpenseList(items, totalCount) {
  if (totalCount === 0) {
    return `
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>Nothing logged for ${monthLabel(state.monthKey)}.<br/>Tap + to add an expense.</p>
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
        <span class="chip" style="background:${c.color}"></span>
        <div class="info">
          <div class="desc">${escapeHtml(tx.desc || c.label)}${tx.recurringId ? ' <span class="recur-badge" title="Repeats monthly">↻</span>' : ""}</div>
          <div class="meta">${c.label} · ${formatDate(tx.date)}</div>
          ${tx.tags && tx.tags.length ? `<div class="tag-pills">${tx.tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="amt expense">-${fmt(tx.amount)}</div>
      </div>`;
      })
      .join("")}
  </div>`;
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

  document.querySelectorAll("[data-filter-cat]").forEach((btn) => {
    btn.onclick = () => {
      state.expenseFilters.category = btn.dataset.filterCat || null;
      // Chip active-state + list both change, so re-render the whole tab section.
      const panel = document.querySelector(".content-panel");
      if (panel) {
        panel.innerHTML = renderExpenses();
        attachExpenseEvents();
      }
    };
  });

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
