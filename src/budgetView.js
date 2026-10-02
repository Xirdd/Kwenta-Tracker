import { DATA, hasOwnSecondBudget } from "./state.js";
import { allExpenseCategories, LEGACY_CATEGORIES } from "./categories.js";

// Which categories get a card on the Budgets tab. Per-device, same pattern as
// theme.js / currency.js / periodMode.js — not synced to Supabase, so it ships
// with no SQL. The selection is only a VIEW preference: hiding a category never
// touches its saved limits or its transactions.
const STORAGE_KEY = "kwenta_budget_visible_cats_v1";

// The suggested toggles, in display order. Ids are the stable category ids
// from categories.js ("bills" is the Utilities category, "transport" is
// Transportation, and so on).
export const PRESET_IDS = [
  "dining",
  "groceries",
  "rent",
  "utang",
  "family",
  "health",
  "subscriptions",
  "transport",
  "bills",
];

// The old combined Food category only enters the picture while something
// still uses it — a saved limit, or past expenses logged under it.
function legacyInUse(cat) {
  return (
    Number(DATA.budgets[cat.id]) > 0 ||
    hasOwnSecondBudget(cat.id) ||
    DATA.transactions.some((t) => t.type === "expense" && t.category === cat.id)
  );
}

function hasLimit(id) {
  return Number(DATA.budgets[id]) > 0 || hasOwnSecondBudget(id);
}

// Everything that can be shown, split the way the picker lists it:
// presets first, then everything else (custom categories, the rest of the
// built-ins, and the legacy Food category when it's still in use).
export function budgetCategoryPool() {
  const base = allExpenseCategories();
  const byId = new Map(base.map((c) => [c.id, c]));
  const presetSet = new Set(PRESET_IDS);
  const presets = PRESET_IDS.map((id) => byId.get(id)).filter(Boolean);
  const legacy = LEGACY_CATEGORIES.filter(legacyInUse);
  const others = [...legacy, ...base.filter((c) => !presetSet.has(c.id))];
  return { presets, others };
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : null;
  } catch (e) {
    return null;
  }
}

function writeStored(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    /* storage full or unavailable — the selection just won't persist */
  }
}

// What's shown before anyone has customized anything: all the presets, plus
// anything that already has a limit set (so nobody's existing budgets vanish
// on update), plus custom categories and the legacy Food category if in use.
export function defaultSelection() {
  const { others } = budgetCategoryPool();
  const ids = new Set(PRESET_IDS);
  others.forEach((c) => {
    if (c.custom || c.legacy || hasLimit(c.id)) ids.add(c.id);
  });
  return [...ids];
}

// The ids currently selected, limited to categories that actually exist
// (a deleted custom category can leave a stale id in storage — ignored here).
export function currentSelection() {
  const { presets, others } = budgetCategoryPool();
  const exists = new Set([...presets, ...others].map((c) => c.id));
  const stored = readStored();
  return (stored ?? defaultSelection()).filter((id) => exists.has(id));
}

// The category objects to render cards for, in stable display order.
export function visibleCategories() {
  const { presets, others } = budgetCategoryPool();
  const selected = new Set(currentSelection());
  return [...presets, ...others].filter((c) => selected.has(c.id));
}

export function setVisibleIds(ids) {
  writeStored(ids);
}

// A newly created custom category should show up right away even if the
// person has already customized their selection.
export function addVisibleCategory(id) {
  const stored = readStored();
  if (stored && !stored.includes(id)) writeStored([...stored, id]);
}
