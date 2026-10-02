import { DATA, saveData, hasOwnSecondBudget } from "./state.js";
import { uid } from "./format.js";
import { isCloudMode, cloudUpsertBudget } from "./sync.js";
import { cloudSetBudgetSecond } from "./budgetLimitsCloud.js";
import {
  cloudUpsertCustomCategory,
  cloudDeleteCustomCategory,
} from "./customCategoriesCloud.js";
import { DEFAULT_ICON_ID, isKnownIcon } from "./icons/categoryIcons.js";
import { notifySyncError } from "./toast.js";

// What's stored on a category is { id, label, color, icon, active } — `icon`
// is only the string id from icons/categoryIcons.js, never SVG markup.

function normalizeIcon(icon) {
  return isKnownIcon(icon) ? icon : DEFAULT_ICON_ID;
}

export function getCustomCategory(id) {
  return DATA.customCategories.find((c) => c.id === id);
}

// Sets (or clears) the category's budget limit — the 1st-15th / whole-month
// limit in DATA.budgets, same field the card's own input edits. Clearing it
// while a separate 2nd-half limit exists stores 0 ("no limit") instead of
// deleting, because deleting the cloud row would take the 2nd-half limit
// with it (see budgetLimitsCloud.js).
function applyLimit(id, limit) {
  const prev = DATA.budgets[id];
  const hasLimit = limit !== undefined && limit !== null && Number(limit) > 0;
  const next = hasLimit
    ? Number(limit)
    : hasOwnSecondBudget(id)
      ? 0
      : undefined;
  if (next === prev) return;

  if (next === undefined) delete DATA.budgets[id];
  else DATA.budgets[id] = next;
  saveData();
  if (isCloudMode())
    cloudUpsertBudget(id, next).catch((e) => notifySyncError(e));
}

// CREATE
export function createCustomCategory({ label, color, icon, limit }) {
  const cat = {
    id: uid("cc"),
    label,
    color,
    icon: normalizeIcon(icon),
    active: true,
  };
  DATA.customCategories.push(cat);
  saveData();
  if (isCloudMode())
    cloudUpsertCustomCategory(cat).catch((e) => notifySyncError(e));
  applyLimit(cat.id, limit);
  return cat;
}

// UPDATE — `limit` is only touched when the caller passes the key at all.
export function updateCustomCategory(cat, fields) {
  cat.label = fields.label;
  cat.color = fields.color;
  cat.icon = normalizeIcon(fields.icon);
  saveData();
  if (isCloudMode())
    cloudUpsertCustomCategory(cat).catch((e) => notifySyncError(e));
  if ("limit" in fields) applyLimit(cat.id, fields.limit);
}

// DELETE — removes the category and any budget limits set on it (both
// halves). Transactions already logged against it are left untouched, same
// convention as deleting a bill or recurring rule; they render under the
// "Others" fallback from then on (see catInfo() in categories.js).
export function deleteCustomCategory(id) {
  DATA.customCategories = DATA.customCategories.filter((c) => c.id !== id);
  delete DATA.budgets[id];
  delete DATA.budgetsSecond[id];
  saveData();
  if (isCloudMode()) {
    cloudDeleteCustomCategory(id).catch((e) => notifySyncError(e));
    cloudUpsertBudget(id, undefined).catch((e) => notifySyncError(e));
    cloudSetBudgetSecond(id, undefined).catch((e) => notifySyncError(e));
  }
}
