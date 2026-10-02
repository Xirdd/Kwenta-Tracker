import "../customCategories.css";
import "./categoryForm.css";
import { DATA, state, periodKeyHasHalf } from "../state.js";
import {
  allExpenseCategories,
  categoryIconBadge,
  CUSTOM_CATEGORY_COLORS,
} from "../categories.js";
import { DEFAULT_ICON_ID, iconPaths } from "../icons/categoryIcons.js";
import { escapeHtml } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { renderIconPicker, attachIconPicker } from "./iconPicker.js";
import {
  createCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
} from "../customCategories.js";
import { addVisibleCategory } from "../budgetView.js";
import { scheduleUndoableDelete } from "../undo.js";

let onChange = () => {};

// Called from initBudgetsSheet() in budgets.js, so main.js needs no change.
export function initCategoryFormSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

function colorSwatchRow(selected) {
  return `
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
    ${CUSTOM_CATEGORY_COLORS.map(
      (hex) => `
      <button type="button" class="color-swatch-btn ${hex === selected ? "selected" : ""}" data-color="${hex}" style="background:${hex};" aria-label="${hex}"></button>`,
    ).join("")}
  </div>`;
}

// `cat` is the raw custom-category object from DATA.customCategories (null to
// create). `draft` carries what was typed so a validation error re-opens the
// form without wiping the fields.
export function openCategoryForm(cat, draft = {}) {
  const isEdit = !!cat;
  const labelVal = draft.label ?? cat?.label ?? "";
  const limitVal =
    draft.limit ?? (cat ? Number(DATA.budgets[cat.id]) || "" : "");
  let chosenColor = draft.color ?? cat?.color ?? CUSTOM_CATEGORY_COLORS[0];
  let chosenIcon = draft.icon ?? cat?.icon ?? DEFAULT_ICON_ID;
  const perHalf = periodKeyHasHalf(state.monthKey);

  const previewHtml = () =>
    categoryIconBadge({ color: chosenColor, icon: iconPaths(chosenIcon) }, 48);

  openModal(`
    <div class="grabber"></div>
    <h3>${isEdit ? "Edit category" : "New budget category"}</h3>
    <div class="cc-name-row">
      <span class="cc-preview" id="ccPreview">${previewHtml()}</span>
      <div class="field">
        <label>Name</label>
        <input id="ccLabel" type="text" maxlength="40" placeholder="e.g. Gym Supplements, Pet Care" value="${escapeHtml(labelVal)}"/>
      </div>
    </div>
    <div class="field amount">
      <label>Budget limit <span class="opt">(optional)</span></label>
      <input id="ccLimit" type="number" inputmode="decimal" min="0" placeholder="0.00" value="${limitVal}"/>
      <p class="field-hint">${perHalf ? "Applies to each half-month. You can set a different limit for the 16th–end on the card." : "Applies to each month."}</p>
    </div>
    <div class="field">
      <label>Color</label>
      <div id="ccColorRow">${colorSwatchRow(chosenColor)}</div>
    </div>
    <div class="field">
      <label>Icon</label>
      ${renderIconPicker(chosenIcon)}
    </div>
    ${draft.error ? `<p class="auth-message" style="color:var(--coral);">${draft.error}</p>` : ""}
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
      document.getElementById("ccPreview").innerHTML = previewHtml();
    };
  });

  attachIconPicker((iconId) => {
    chosenIcon = iconId;
    document.getElementById("ccPreview").innerHTML = previewHtml();
  });

  document.getElementById("ccCancelBtn").onclick = closeModal;

  document.getElementById("ccSaveBtn").onclick = () => {
    const typed = {
      label: document.getElementById("ccLabel").value,
      limit: document.getElementById("ccLimit").value,
      color: chosenColor,
      icon: chosenIcon,
    };
    const fail = (error) => openCategoryForm(cat, { ...typed, error });
    const label = typed.label.trim();

    if (!label) return fail("Give this category a name.");

    // Covers the reserved "Others" label too, since it's in this list.
    const clash = allExpenseCategories().some(
      (c) => c.id !== cat?.id && c.label.toLowerCase() === label.toLowerCase(),
    );
    if (clash) return fail("A category with that name already exists.");

    let limit;
    if (typed.limit !== "") {
      const n = Number(typed.limit);
      if (!Number.isFinite(n) || n < 0)
        return fail("Budget limit must be a positive number.");
      limit = n > 0 ? n : undefined; // 0 means "no limit"
    }

    const fields = { label, color: chosenColor, icon: chosenIcon, limit };
    if (isEdit) {
      updateCustomCategory(cat, fields);
    } else {
      const created = createCustomCategory(fields);
      // Show it right away, even if the visible-category selection was customized.
      addVisibleCategory(created.id);
    }
    closeModal();
    onChange();
  };

  if (isEdit) {
    document.getElementById("ccDeleteBtn").onclick = () =>
      confirmDeleteCategory(cat);
  }
}

function confirmDeleteCategory(cat) {
  const used = DATA.transactions.filter(
    (t) => t.type === "expense" && t.category === cat.id,
  ).length;
  const impact = used
    ? `${used} logged expense${used === 1 ? "" : "s"} will show under "Others" from now on, and its budget limit is removed.`
    : "Its budget limit is removed. No expenses are logged under it.";

  openModal(`
    <div class="grabber"></div>
    <h3>Delete "${escapeHtml(cat.label)}"?</h3>
    <p class="auth-message">${impact} You can undo for a few seconds after.</p>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="ccKeepBtn">Keep it</button>
      <button class="btn btn-danger" id="ccConfirmDeleteBtn">Delete</button>
    </div>
  `);
  document.getElementById("ccKeepBtn").onclick = () => openCategoryForm(cat);
  document.getElementById("ccConfirmDeleteBtn").onclick = () => {
    closeModal();
    // deleteCustomCategory() clears the limits too — capture them so Undo
    // restores the whole category, not just its name/color/icon.
    const firstBudget = DATA.budgets[cat.id];
    const secondBudget = DATA.budgetsSecond[cat.id];
    scheduleUndoableDelete({
      label: `"${cat.label}"`,
      remove: () => {
        DATA.customCategories = DATA.customCategories.filter(
          (c) => c.id !== cat.id,
        );
        onChange();
      },
      restore: () => {
        DATA.customCategories.push(cat);
        if (firstBudget !== undefined) DATA.budgets[cat.id] = firstBudget;
        if (secondBudget !== undefined)
          DATA.budgetsSecond[cat.id] = secondBudget;
        onChange();
      },
      commit: () => deleteCustomCategory(cat.id),
    });
  };
}
