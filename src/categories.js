import { DATA } from "./state.js";
import { iconPaths } from "./icons/categoryIcons.js";

// Simple line-icon SVGs (24x24 viewBox, stroke-based) — one per category, used
// for the icon-badge treatment (colored circle + icon) instead of plain dots.
const ICONS = {
  food: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`,
  dining: `<path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2"/><path d="M6 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7"/>`,
  groceries: `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>`,
  subscriptions: `<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`,
  transport: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>`,
  electricity: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  water: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`,
  wifi: `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`,
  gadget: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
  bills: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  rent: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  load: `<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>`,
  health: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
  shopping: `<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
  fun: `<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>`,
  savings: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  family: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  utang: `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  other: `<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>`,
  bonus: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
  freelance: `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  allowance: `<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
};

// Custom (user-created) categories each store an icon id chosen from
// icons/categoryIcons.js; iconPaths() turns it into SVG markup, falling back
// to the price tag for a missing or unknown id.

// A curated palette for custom categories to pick from — reuses hues already
// used elsewhere in the app so a custom category never clashes.
export const CUSTOM_CATEGORY_COLORS = [
  "#e2604a",
  "#d4a72c",
  "#3fa377",
  "#5b7fde",
  "#8e5fd6",
  "#d65a8e",
  "#4fb8c9",
  "#7fae3f",
  "#c77b3f",
  "#e893a8",
];

// IDs are stable and never change — only labels do. That's what keeps every
// existing transaction and saved budget limit pointing at the right category
// after a relabel ("transport" is now shown as "Transportation", etc.).
export const CATEGORIES = [
  { id: "dining", label: "Food / Dining Out", color: "#e2604a" },
  { id: "groceries", label: "Groceries", color: "#3aa6a0" },
  { id: "transport", label: "Transportation", color: "#d4a72c" },
  { id: "electricity", label: "Electricity", color: "#f4c430" },
  { id: "water", label: "Water", color: "#2b8fd6" },
  { id: "wifi", label: "WiFi & Internet", color: "#8e5fd6" },
  { id: "gadget", label: "Gadget Installment", color: "#d65a8e" },
  { id: "bills", label: "Utilities", color: "#3fa377" },
  { id: "rent", label: "Rent / Housing", color: "#5b7fde" },
  { id: "load", label: "Load & Internet", color: "#b26fd1" },
  { id: "health", label: "Health & Medical", color: "#4fb8c9" },
  { id: "shopping", label: "Shopping", color: "#e893a8" },
  { id: "fun", label: "Entertainment", color: "#f0a93f" },
  {
    id: "subscriptions",
    label: "Memberships & Subscriptions",
    color: "#7a6fe0",
  },
  { id: "savings", label: "Savings", color: "#7fae3f" },
  { id: "family", label: "Family Support", color: "#c77b3f" },
  { id: "utang", label: "Utang / Loans", color: "#a4443c" },
  { id: "other", label: "Others", color: "#8c8c7a" },
].map((c) => ({ ...c, icon: ICONS[c.id] }));

// The old combined "Food & Groceries" category. It can't just disappear:
// transactions already logged under id "food" (and any budget limit saved
// for it) still need to resolve to a real label and color. It's kept out of
// CATEGORIES, so it never appears in the Add/Edit expense picker again — the
// Budgets tab only offers it while something is still using it
// (see budgetView.js).
export const LEGACY_CATEGORIES = [
  {
    id: "food",
    label: "Food & Groceries",
    color: "#e2604a",
    icon: ICONS.food,
    legacy: true,
  },
];

export function catInfo(id) {
  const builtin = CATEGORIES.find((c) => c.id === id);
  if (builtin) return builtin;
  const legacy = LEGACY_CATEGORIES.find((c) => c.id === id);
  if (legacy) return legacy;
  const custom = (DATA.customCategories || []).find(
    (c) => c.id === id && c.active !== false,
  );
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      color: custom.color,
      icon: iconPaths(custom.icon),
      custom: true,
    };
  }
  // Unknown id (including a deleted custom category) — same fallback as
  // before, so old transactions never render blank.
  return CATEGORIES[CATEGORIES.length - 1];
}

// Every category a NEW/EDITED expense (or the Budgets tab) can be assigned
// to: the fixed built-ins, then any active custom categories, with "Others"
// kept last so it still reads as the catch-all. Income has no custom
// categories — INCOME_CATEGORIES is untouched. The legacy "food" category is
// deliberately not in here.
export function allExpenseCategories() {
  const others = CATEGORIES[CATEGORIES.length - 1];
  const fixed = CATEGORIES.slice(0, -1);
  const custom = (DATA.customCategories || [])
    .filter((c) => c.active !== false)
    .map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
      icon: iconPaths(c.icon),
      custom: true,
    }));
  return [...fixed, ...custom, others];
}

// A focused subset shown in the Bills form specifically — common Philippine
// household bills, plus "Others" (which prompts for a custom label).
export const BILL_CATEGORIES = [
  "electricity",
  "water",
  "wifi",
  "gadget",
  "other",
].map(catInfo);

export const INCOME_CATEGORIES = [
  { id: "bonus", label: "Bonus / 13th Month", color: "#d4a72c" },
  { id: "freelance", label: "Freelance / Side Hustle", color: "#3fa377" },
  { id: "allowance", label: "Allowance", color: "#5b7fde" },
  { id: "utang", label: "Utang/Loan", color: "#a4443c" },
  { id: "other", label: "Other Income", color: "#8c8c7a" },
].map((c) => ({ ...c, icon: ICONS[c.id] }));

export function incCatInfo(id) {
  return (
    INCOME_CATEGORIES.find((c) => c.id === id) ||
    INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1]
  );
}

// Renders a category's icon inside a tinted circle — the shared "icon badge"
// look used everywhere a plain colored dot used to be (transaction rows,
// category picker, budgets, etc.). Background is the category color at low
// opacity, icon itself is full-strength — the standard Mint/YNAB pattern.
export function categoryIconBadge(cat, size = 36) {
  return `<span class="cat-icon-badge" style="background:${cat.color}26;color:${cat.color};width:${size}px;height:${size}px;">
    <svg width="${Math.round(size * 0.5)}" height="${Math.round(size * 0.5)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cat.icon || ICONS.other}</svg>
  </span>`;
}
