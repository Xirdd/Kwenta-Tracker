// Simple line-icon SVGs (24x24 viewBox, stroke-based) — one per category, used
// for the icon-badge treatment (colored circle + icon) instead of plain dots.
const ICONS = {
  food: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`,
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

export const CATEGORIES = [
  { id: "food", label: "Food & Groceries", color: "#e2604a" },
  { id: "transport", label: "Transport", color: "#d4a72c" },
  { id: "electricity", label: "Electricity", color: "#f4c430" },
  { id: "water", label: "Water", color: "#2b8fd6" },
  { id: "wifi", label: "WiFi & Internet", color: "#8e5fd6" },
  { id: "gadget", label: "Gadget Installment", color: "#d65a8e" },
  { id: "bills", label: "Bills & Utilities", color: "#3fa377" },
  { id: "rent", label: "Rent", color: "#5b7fde" },
  { id: "load", label: "Load & Internet", color: "#b26fd1" },
  { id: "health", label: "Health", color: "#4fb8c9" },
  { id: "shopping", label: "Shopping", color: "#e893a8" },
  { id: "fun", label: "Entertainment", color: "#f0a93f" },
  { id: "savings", label: "Savings", color: "#7fae3f" },
  { id: "family", label: "Family Support", color: "#c77b3f" },
  { id: "utang", label: "Utang/Loan", color: "#a4443c" },
  { id: "other", label: "Others", color: "#8c8c7a" },
].map((c) => ({ ...c, icon: ICONS[c.id] }));

export function catInfo(id) {
  return (
    CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]
  );
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
