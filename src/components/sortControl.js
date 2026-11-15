import "./sortControl.css";
import "./optionList.css";
import { openModal, closeModal } from "./modal.js";
import { escapeHtml } from "../format.js";
import {
  sortOptions,
  getSortId,
  setSortId,
  sortShortLabel,
} from "../sorting.js";

// The one Sort control used by every list (Expenses, Income, Bills, Budgets,
// Utang, Installments).
//
//   renderSortButton("expenses")  → the small "⇅ Sort · Newest first" pill.
//                                   Put it in a tab's markup.
//   initSortControl(rerender)     → call ONCE at startup (main.js). It listens
//                                   on `document`, so buttons keep working
//                                   after any re-render, including the Expenses
//                                   tab re-drawing just its own panel.
//
// Picking an option saves it (sorting.js) and calls `rerender`. The data itself
// is never changed — only the order it is drawn in.

const SORT_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`;
const CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

let onChange = () => {};

export function renderSortButton(viewId) {
  return `
  <div class="sort-row">
    <button type="button" class="sort-btn" data-sort-view="${escapeHtml(viewId)}" aria-haspopup="dialog">
      ${SORT_ICON}<span class="sort-btn-label">Sort</span><span class="sort-btn-value">${escapeHtml(sortShortLabel(viewId))}</span>
    </button>
  </div>`;
}

function openSortSheet(viewId) {
  const options = sortOptions(viewId);
  if (options.length === 0) return;
  const selected = getSortId(viewId);

  openModal(`
    <div class="grabber"></div>
    <h3>Sort by</h3>
    <div class="opt-list" role="radiogroup" aria-label="Sort by">
      ${options
        .map(
          (opt) => `
        <button type="button" class="opt-row ${opt.id === selected ? "selected" : ""}" role="radio" aria-checked="${opt.id === selected}" data-sort-opt="${escapeHtml(opt.id)}">
          <span class="opt-text"><span class="opt-label">${escapeHtml(opt.label)}</span></span>
          <span class="opt-check">${CHECK}</span>
        </button>`,
        )
        .join("")}
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="sortCancelBtn">Cancel</button>
    </div>
  `);

  document.getElementById("sortCancelBtn").onclick = closeModal;
  document.querySelectorAll("[data-sort-opt]").forEach((btn) => {
    btn.onclick = () => {
      setSortId(viewId, btn.dataset.sortOpt);
      closeModal();
      onChange(); // redraws with the new order — instant, nothing is saved or synced
    };
  });
}

export function initSortControl(rerenderCallback) {
  onChange = rerenderCallback;
  document.addEventListener("click", (e) => {
    const btn =
      e.target instanceof Element && e.target.closest("[data-sort-view]");
    if (btn) openSortSheet(btn.dataset.sortView);
  });
}
