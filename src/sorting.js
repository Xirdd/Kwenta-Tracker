import { catInfo, incCatInfo } from "./categories.js";
import { budgetFor } from "./state.js";
import { findPaymentTx } from "./bills.js";
import { nextDueDate } from "./installments.js";

// One place that defines how every list in the app can be sorted.
//
//   sortList(viewId, items, ctx)   returns a NEW sorted array — the saved data
//                                  is never touched, so the UI can re-sort
//                                  instantly and nothing needs to sync.
//   getSortId / setSortId          the person's choice per list, kept on this
//                                  device (localStorage), like theme/currency.
//
// Each option is either { key, type, dir } (compare one value) or a custom
// { compare }. Missing values always sort last, in either direction. `ctx`
// carries anything a list needs beyond the item itself (e.g. spent per
// category for Budgets).

const STORAGE_KEY = "kwenta_sort_v1";

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

const isBlank = (v) =>
  v === undefined || v === null || v === "" || Number.isNaN(v);

function compareValues(type, a, b) {
  if (type === "text")
    return String(a).localeCompare(String(b), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  if (type === "date") return a < b ? -1 : a > b ? 1 : 0; // ISO strings sort as text
  return Number(a) - Number(b);
}

function buildComparator(opt, then) {
  const base =
    opt.compare ||
    ((a, b, ctx) => {
      const va = opt.key(a, ctx);
      const vb = opt.key(b, ctx);
      const blankA = isBlank(va);
      const blankB = isBlank(vb);
      if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1;
      const c = compareValues(opt.type, va, vb);
      return opt.dir === "desc" ? -c : c;
    });
  return (a, b, ctx) => base(a, b, ctx) || (then ? then(a, b, ctx) : 0);
}

// o(id, label, short, key, type, dir): label is the row in the sheet, short is
// what the button shows.
const o = (id, label, short, key, type, dir) => ({
  id,
  label,
  short,
  key,
  type,
  dir,
});
const custom = (id, label, short, compare) => ({ id, label, short, compare });

const byDateDesc = (get) => (a, b) =>
  String(get(b) || "").localeCompare(String(get(a) || ""));

// ── Transactions (Expenses and Income) ──────────────────────────────────
function txOptions(catFor) {
  const name = (t) => (t.desc || "").trim() || catFor(t.category).label;
  return [
    o(
      "date-desc",
      "Date · Newest first",
      "Newest first",
      (t) => t.date,
      "date",
      "desc",
    ),
    o(
      "date-asc",
      "Date · Oldest first",
      "Oldest first",
      (t) => t.date,
      "date",
      "asc",
    ),
    o(
      "amount-desc",
      "Amount · Highest first",
      "Highest first",
      (t) => t.amount,
      "num",
      "desc",
    ),
    o(
      "amount-asc",
      "Amount · Lowest first",
      "Lowest first",
      (t) => t.amount,
      "num",
      "asc",
    ),
    o("name-asc", "Name · A to Z", "A to Z", name, "text", "asc"),
    o("name-desc", "Name · Z to A", "Z to A", name, "text", "desc"),
    o(
      "category-asc",
      "Category · A to Z",
      "Category",
      (t) => catFor(t.category).label,
      "text",
      "asc",
    ),
  ];
}
const txThen = byDateDesc((t) => t.date);

// ── Bills ───────────────────────────────────────────────────────────────
const billName = (b) => b.name;
const billAmount = (b, ctx) => {
  const paid = ctx.monthKey ? findPaymentTx(b.id, ctx.monthKey) : null;
  return paid ? paid.amount : b.estimatedAmount;
};
const billCategory = (b) => b.customCategory || catInfo(b.category).label;

// ── Utang ───────────────────────────────────────────────────────────────
// Items are { loan, remaining }. Utang has no due date, so "how much is left
// to settle" plays that role.
const loanDefault = (a, b) => {
  const aSettled = a.remaining <= 0;
  const bSettled = b.remaining <= 0;
  if (aSettled !== bSettled) return aSettled ? 1 : -1; // open ones first
  return (b.loan.date || "").localeCompare(a.loan.date || "");
};

export const SORT_VIEWS = {
  expenses: {
    defaultId: "date-desc",
    then: txThen,
    options: txOptions(catInfo),
  },
  income: {
    defaultId: "date-desc",
    then: txThen,
    options: txOptions(incCatInfo),
  },
  bills: {
    defaultId: "default",
    options: [
      custom(
        "default",
        "Unpaid first, then due date",
        "Default",
        (a, b, ctx) => {
          const aPaid = ctx.monthKey
            ? !!findPaymentTx(a.id, ctx.monthKey)
            : false;
          const bPaid = ctx.monthKey
            ? !!findPaymentTx(b.id, ctx.monthKey)
            : false;
          if (aPaid !== bPaid) return aPaid ? 1 : -1;
          return a.dueDay - b.dueDay;
        },
      ),
      o(
        "due-asc",
        "Due date · Earliest first",
        "Due soonest",
        (b) => b.dueDay,
        "num",
        "asc",
      ),
      o(
        "due-desc",
        "Due date · Latest first",
        "Due latest",
        (b) => b.dueDay,
        "num",
        "desc",
      ),
      o(
        "amount-desc",
        "Amount · Highest first",
        "Highest first",
        billAmount,
        "num",
        "desc",
      ),
      o(
        "amount-asc",
        "Amount · Lowest first",
        "Lowest first",
        billAmount,
        "num",
        "asc",
      ),
      o("name-asc", "Name · A to Z", "A to Z", billName, "text", "asc"),
      o("name-desc", "Name · Z to A", "Z to A", billName, "text", "desc"),
      o(
        "category-asc",
        "Category · A to Z",
        "Category",
        billCategory,
        "text",
        "asc",
      ),
    ],
  },
  budgets: {
    defaultId: "default",
    options: [
      custom("default", "Default order", "Default", () => 0),
      o("name-asc", "Name · A to Z", "A to Z", (c) => c.label, "text", "asc"),
      o("name-desc", "Name · Z to A", "Z to A", (c) => c.label, "text", "desc"),
      // A limit of 0 means "none set", which should sort last, not first.
      o(
        "limit-desc",
        "Budget limit · Highest first",
        "Highest limit",
        (c) => budgetFor(c.id) || null,
        "num",
        "desc",
      ),
      o(
        "limit-asc",
        "Budget limit · Lowest first",
        "Lowest limit",
        (c) => budgetFor(c.id) || null,
        "num",
        "asc",
      ),
      o(
        "spent-desc",
        "Spent · Highest first",
        "Most spent",
        (c, ctx) => (ctx.spent || {})[c.id] || 0,
        "num",
        "desc",
      ),
      o(
        "spent-asc",
        "Spent · Lowest first",
        "Least spent",
        (c, ctx) => (ctx.spent || {})[c.id] || 0,
        "num",
        "asc",
      ),
      o(
        "used-desc",
        "Closest to limit first",
        "Closest to limit",
        (c, ctx) => {
          const limit = budgetFor(c.id);
          return limit > 0 ? ((ctx.spent || {})[c.id] || 0) / limit : null;
        },
        "num",
        "desc",
      ),
    ],
  },
  loans: {
    defaultId: "default",
    options: [
      custom("default", "Open first, then newest", "Default", loanDefault),
      o(
        "date-desc",
        "Date · Newest first",
        "Newest first",
        (r) => r.loan.date,
        "date",
        "desc",
      ),
      o(
        "date-asc",
        "Date · Oldest first",
        "Oldest first",
        (r) => r.loan.date,
        "date",
        "asc",
      ),
      o(
        "amount-desc",
        "Amount · Highest first",
        "Highest first",
        (r) => r.loan.amount,
        "num",
        "desc",
      ),
      o(
        "amount-asc",
        "Amount · Lowest first",
        "Lowest first",
        (r) => r.loan.amount,
        "num",
        "asc",
      ),
      o(
        "remaining-desc",
        "Remaining · Most first",
        "Most remaining",
        (r) => r.remaining,
        "num",
        "desc",
      ),
      o(
        "remaining-asc",
        "Remaining · Least first",
        "Least remaining",
        (r) => r.remaining,
        "num",
        "asc",
      ),
      o(
        "name-asc",
        "Name · A to Z",
        "A to Z",
        (r) => r.loan.person,
        "text",
        "asc",
      ),
      o(
        "name-desc",
        "Name · Z to A",
        "Z to A",
        (r) => r.loan.person,
        "text",
        "desc",
      ),
    ],
  },
  installments: {
    defaultId: "due-asc",
    options: [
      // Completed plans have no next due date, so they sort last either way.
      o(
        "due-asc",
        "Due date · Soonest first",
        "Due soonest",
        (p) => nextDueDate(p),
        "date",
        "asc",
      ),
      o(
        "due-desc",
        "Due date · Latest first",
        "Due latest",
        (p) => nextDueDate(p),
        "date",
        "desc",
      ),
      o(
        "months-asc",
        "Remaining months · Fewest first",
        "Fewest months left",
        (p) => p.remainingMonths,
        "num",
        "asc",
      ),
      o(
        "months-desc",
        "Remaining months · Most first",
        "Most months left",
        (p) => p.remainingMonths,
        "num",
        "desc",
      ),
      o(
        "monthly-desc",
        "Monthly payment · Highest first",
        "Highest monthly",
        (p) => p.monthlyAmount,
        "num",
        "desc",
      ),
      o(
        "monthly-asc",
        "Monthly payment · Lowest first",
        "Lowest monthly",
        (p) => p.monthlyAmount,
        "num",
        "asc",
      ),
      o(
        "total-desc",
        "Total amount · Highest first",
        "Highest total",
        (p) => p.totalAmount,
        "num",
        "desc",
      ),
      o(
        "total-asc",
        "Total amount · Lowest first",
        "Lowest total",
        (p) => p.totalAmount,
        "num",
        "asc",
      ),
      o("name-asc", "Name · A to Z", "A to Z", (p) => p.name, "text", "asc"),
      o("name-desc", "Name · Z to A", "Z to A", (p) => p.name, "text", "desc"),
    ],
  },
};

// ── Public API ──────────────────────────────────────────────────────────
export function sortOptions(viewId) {
  return SORT_VIEWS[viewId]?.options || [];
}

export function getSortId(viewId) {
  const view = SORT_VIEWS[viewId];
  if (!view) return null;
  const saved = readAll()[viewId];
  return view.options.some((x) => x.id === saved) ? saved : view.defaultId;
}

export function setSortId(viewId, id) {
  const view = SORT_VIEWS[viewId];
  if (!view || !view.options.some((x) => x.id === id)) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readAll(), [viewId]: id }),
    );
  } catch (e) {
    /* storage full or unavailable — the choice just won't persist */
  }
}

export function sortShortLabel(viewId) {
  const id = getSortId(viewId);
  return sortOptions(viewId).find((x) => x.id === id)?.short || "";
}

// Always returns a copy. Never sorts `items` in place.
export function sortList(viewId, items, ctx = {}) {
  const view = SORT_VIEWS[viewId];
  if (!view) return items.slice();
  const id = getSortId(viewId);
  const opt = view.options.find((x) => x.id === id) || view.options[0];
  const cmp = buildComparator(opt, view.then);
  return items.slice().sort((a, b) => cmp(a, b, ctx));
}
