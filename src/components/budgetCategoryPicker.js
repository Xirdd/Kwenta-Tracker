import "./budgetCategoryPicker.css";
import { openModal, closeModal } from "./modal.js";
import { categoryIconBadge } from "../categories.js";
import { escapeHtml } from "../format.js";
import {
  budgetCategoryPool,
  currentSelection,
  defaultSelection,
  setVisibleIds,
} from "../budgetView.js";

let onChange = () => {};

// Called from initBudgetsSheet() in budgets.js, so main.js needs no change.
export function initBudgetCategoryPicker(rerenderCallback) {
  onChange = rerenderCallback;
}

function pickRow(cat, checked) {
  return `
  <label class="pick-row">
    ${categoryIconBadge(cat, 34)}
    <span class="pick-text">
      <span class="pick-label">${escapeHtml(cat.label)}</span>
      ${cat.legacy ? `<span class="pick-note">Old combined category, now split into Dining Out and Groceries.</span>` : ""}
    </span>
    <input type="checkbox" class="pick-check" data-cat="${cat.id}" ${checked ? "checked" : ""}/>
    <span class="pick-switch" aria-hidden="true"></span>
  </label>`;
}

export function openBudgetCategoryPicker() {
  const { presets, others } = budgetCategoryPool();
  const all = [...presets, ...others];
  let working = new Set(currentSelection());

  openModal(`
    <div class="grabber"></div>
    <h3>Choose categories</h3>
    <p class="auth-message">Only selected categories get a budget card and count toward your totals. Hidden ones keep their limits and expenses.</p>
    <div class="pick-toolbar">
      <span class="pick-count" id="pickCount"></span>
      <div class="pick-quick">
        <button type="button" class="pick-chip" id="pickAllBtn">Select all</button>
        <button type="button" class="pick-chip" id="pickNoneBtn">Clear</button>
        <button type="button" class="pick-chip" id="pickDefaultBtn">Defaults</button>
      </div>
    </div>
    <div class="pick-list">
      <div class="pick-group-label">Suggested</div>
      ${presets.map((c) => pickRow(c, working.has(c.id))).join("")}
      ${
        others.length
          ? `<div class="pick-group-label">More categories</div>
      ${others.map((c) => pickRow(c, working.has(c.id))).join("")}`
          : ""
      }
    </div>
    <div class="sheet-actions" style="margin-top:16px;">
      <button class="btn btn-ghost" id="pickCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="pickSaveBtn">Save</button>
    </div>
  `);

  const boxes = () => document.querySelectorAll(".pick-check");

  function updateCount() {
    document.getElementById("pickCount").textContent =
      `${working.size} of ${all.length} selected`;
  }
  function syncBoxes() {
    boxes().forEach((b) => {
      b.checked = working.has(b.dataset.cat);
    });
    updateCount();
  }

  boxes().forEach((b) => {
    b.onchange = () => {
      if (b.checked) working.add(b.dataset.cat);
      else working.delete(b.dataset.cat);
      updateCount();
    };
  });

  document.getElementById("pickAllBtn").onclick = () => {
    working = new Set(all.map((c) => c.id));
    syncBoxes();
  };
  document.getElementById("pickNoneBtn").onclick = () => {
    working = new Set();
    syncBoxes();
  };
  document.getElementById("pickDefaultBtn").onclick = () => {
    const valid = new Set(all.map((c) => c.id));
    working = new Set(defaultSelection().filter((id) => valid.has(id)));
    syncBoxes();
  };

  document.getElementById("pickCancelBtn").onclick = closeModal;
  document.getElementById("pickSaveBtn").onclick = () => {
    setVisibleIds(all.map((c) => c.id).filter((id) => working.has(id)));
    closeModal();
    onChange();
  };

  updateCount();
}
