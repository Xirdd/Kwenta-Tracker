import { DATA, saveData } from "./state.js";
import { uid } from "./format.js";
import { isCloudMode, cloudUpsertBudget } from "./sync.js";
import { cloudSetBudgetSecond } from "./budgetLimitsCloud.js";
import {
  cloudUpsertCustomCategory,
  cloudDeleteCustomCategory,
} from "./customCategoriesCloud.js";
import { notifySyncError } from "./toast.js";

export function getCustomCategory(id) {
  return DATA.customCategories.find((c) => c.id === id);
}

export function createCustomCategory({ label, color }) {
  const cat = { id: uid("cc"), label, color, active: true };
  DATA.customCategories.push(cat);
  saveData();
  if (isCloudMode())
    cloudUpsertCustomCategory(cat).catch((e) => notifySyncError(e));
  return cat;
}

export function updateCustomCategory(cat, { label, color }) {
  cat.label = label;
  cat.color = color;
  saveData();
  if (isCloudMode())
    cloudUpsertCustomCategory(cat).catch((e) => notifySyncError(e));
}

// Removes the category and any budget limits set on it (both halves).
// Transactions already logged against it are left untouched — same
// convention as deleting a bill or recurring rule — they'll just render
// under the "Others" fallback from then on (see catInfo() in categories.js).
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
