import { loadData, persist } from "./storage.js";
import {
  isCloudMode,
  cloudLoadAll,
  cloudMigrateLocalDataIfEmpty,
} from "./sync.js";
import {
  cloudLoadBudgetsSecond,
  cloudSetBudgetSecond,
} from "./budgetLimitsCloud.js";
import {
  cloudLoadCustomCategories,
  cloudUpsertCustomCategory,
} from "./customCategoriesCloud.js";

export let DATA = {
  salary: {},
  transactions: [],
  // Budget limits are semi-monthly. `budgets[cat]` is the 1st–15th limit (and,
  // for anything saved before limits were split, the limit for both halves).
  // `budgetsSecond[cat]` is an OPTIONAL separate limit for the 16th–end half;
  // when a category has none, the 16th–end half uses budgets[cat]. Read limits
  // through budgetFor() below rather than indexing these directly.
  budgets: {},
  budgetsSecond: {},
  // User-created expense categories, beyond the fixed list in categories.js —
  // see customCategories.js for CRUD and categories.js's catInfo()/
  // allExpenseCategories() for how they're merged in everywhere a category
  // is shown or picked.
  customCategories: [],
  recurring: [],
  bills: [],
  goals: [],
  loans: [],
};

// state.monthKey is now a semi-monthly PERIOD key: "YYYY-MM-1" (1st–15th) or
// "YYYY-MM-2" (16th–end of month). The field name stays `monthKey` (rather
// than renaming to `periodKey` everywhere) deliberately — every other file
// that reads state.monthKey, calls monthLabel()/monthTx()/shiftMonth(), etc.
// keeps working unchanged; only what those functions actually mean changes.
// Two things deliberately did NOT move to periods and stay full-month:
// Bills (bills.js keeps its own independent month key — a bill like Meralco
// is a monthly obligation, not a per-cutoff one) and Goals (target dates are
// long-range, "by December" reads oddly as "by the 2nd half of December").

export const state = {
  monthKey: periodKeyOf(new Date()),
  section: "overview", // bottom nav: 'overview' | 'goals' | 'loans'
  tab: "overview", // sub-tab used only when section === 'overview'
  editingId: null,
  expenseFilters: { query: "", category: null },
};

function daysInMonth(year, month /* 1-indexed */) {
  return new Date(year, month, 0).getDate();
}

// Which half a given Date falls into, as a period key.
export function periodKeyOf(d) {
  const half = d.getDate() <= 15 ? 1 : 2;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${half}`;
}

// { start, end } as "YYYY-MM-DD" strings — end correctly accounts for the
// actual last day of the month (28/29/30/31), not a hardcoded 30.
export function periodRange(key) {
  const [y, m, half] = key.split("-").map(Number);
  const startDay = half === 1 ? 1 : 16;
  const endDay = half === 1 ? 15 : daysInMonth(y, m);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(m)}-${pad(startDay)}`,
    end: `${y}-${pad(m)}-${pad(endDay)}`,
  };
}

// Kept name: monthKeyOf. Now returns a period key rather than "YYYY-MM".
export function monthKeyOf(d) {
  return periodKeyOf(d);
}

// Kept name: monthLabel. Now returns e.g. "September 1–15, 2026".
export function monthLabel(key) {
  const [y, m, half] = key.split("-").map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  });
  const startDay = half === 1 ? 1 : 16;
  const endDay = half === 1 ? 15 : daysInMonth(y, m);
  return `${monthName} ${startDay}\u2013${endDay}, ${y}`;
}

// Just the "YYYY-MM" calendar-month portion of a period key — for the few
// places (bills.js, billsTab.js) that intentionally stay month-scoped and
// need to derive the underlying month from state.monthKey.
export function monthPortionOf(periodKey) {
  return periodKey.slice(0, 7);
}

// 1 for the 1st–15th, 2 for the 16th–end — the half a period key belongs to.
export function halfOfKey(periodKey) {
  return Number(String(periodKey).split("-")[2]) === 2 ? 2 : 1;
}

// True if this category has its own separate 16th–end limit (as opposed to
// inheriting the 1st–15th one). An explicit 0 counts — it means "no limit in
// the 2nd half" even when the 1st half has one.
export function hasOwnSecondBudget(catId) {
  const v = DATA.budgetsSecond[catId];
  return v !== undefined && v !== null;
}

// The budget limit that applies to a category in a given period (defaults to
// the period currently being viewed). 0 means no limit.
export function budgetFor(catId, periodKey = state.monthKey) {
  const first = Number(DATA.budgets[catId]) || 0;
  if (halfOfKey(periodKey) === 1) return first;
  return hasOwnSecondBudget(catId)
    ? Number(DATA.budgetsSecond[catId]) || 0
    : first;
}

// Kept name: shiftMonth. Moves one period forward/back, correctly rolling
// over month and year boundaries (verified against Dec->Jan and Jan->Dec).
export function shiftMonth(delta) {
  let [y, m, half] = state.monthKey.split("-").map(Number);
  const steps = Math.abs(delta);
  const dir = delta > 0 ? 1 : -1;
  for (let i = 0; i < steps; i++) {
    if (dir > 0) {
      if (half === 1) {
        half = 2;
      } else {
        half = 1;
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
    } else {
      if (half === 2) {
        half = 1;
      } else {
        half = 2;
        m -= 1;
        if (m < 1) {
          m = 12;
          y -= 1;
        }
      }
    }
  }
  state.monthKey = `${y}-${String(m).padStart(2, "0")}-${half}`;
  state.expenseFilters = { query: "", category: null };
}

// The optional 2nd-half limits and custom categories each live in their own
// cloud modules (so sync.js stays untouched). If either load fails — offline,
// or the matching SQL migration hasn't been run yet — fall back to what's
// already on this device instead of losing them or blocking the whole load.
async function attachSideTables(cloud, fallback) {
  try {
    cloud.budgetsSecond = await cloudLoadBudgetsSecond();
  } catch (e) {
    console.error("Couldn't load 2nd-half budget limits", e);
    cloud.budgetsSecond = fallback.budgetsSecond || {};
  }
  try {
    cloud.customCategories = await cloudLoadCustomCategories();
  } catch (e) {
    console.error("Couldn't load custom categories", e);
    cloud.customCategories = fallback.customCategories || [];
  }
}

// First sign-in on a device whose cloud account was empty: the app already
// pushes local data up (cloudMigrateLocalDataIfEmpty), which only knows the
// tables sync.js owns — this carries the side tables along too.
async function pushSideTables(local) {
  for (const [cat, amt] of Object.entries(local.budgetsSecond || {})) {
    try {
      await cloudSetBudgetSecond(cat, amt);
    } catch (e) {
      console.error("Couldn't upload 2nd-half budget limit", e);
    }
  }
  for (const cat of local.customCategories || []) {
    try {
      await cloudUpsertCustomCategory(cat);
    } catch (e) {
      console.error("Couldn't upload custom category", e);
    }
  }
}

// Loads DATA from the cloud if signed in, otherwise from localStorage.
export async function initData() {
  if (isCloudMode()) {
    const local = loadData(); // in case this is the very first sign-in on this device
    const migrated = await cloudMigrateLocalDataIfEmpty(local);
    if (migrated) await pushSideTables(local);
    const cloud = await cloudLoadAll();
    if (cloud) await attachSideTables(cloud, local);
    replaceData(cloud || local);
  } else {
    replaceData(loadData());
  }
}

// Re-loads from the cloud after a sign-in event (mid-session, not on first boot).
export async function switchToCloudData() {
  const local = {
    salary: DATA.salary,
    transactions: DATA.transactions,
    budgets: DATA.budgets,
    budgetsSecond: DATA.budgetsSecond,
    customCategories: DATA.customCategories,
    recurring: DATA.recurring,
    bills: DATA.bills,
    goals: DATA.goals,
    loans: DATA.loans,
  };
  const migrated = await cloudMigrateLocalDataIfEmpty(local);
  if (migrated) await pushSideTables(local);
  const cloud = await cloudLoadAll();
  if (cloud) {
    await attachSideTables(cloud, local);
    replaceData(cloud);
  }
}

// Falls back to localStorage after a sign-out.
export function switchToLocalData() {
  replaceData(loadData());
}

function replaceData(next) {
  DATA.salary = next.salary || {};
  DATA.transactions = next.transactions || [];
  DATA.budgets = next.budgets || {};
  DATA.budgetsSecond = next.budgetsSecond || {};
  DATA.customCategories = next.customCategories || [];
  DATA.recurring = next.recurring || [];
  DATA.bills = next.bills || [];
  DATA.goals = next.goals || [];
  DATA.loans = next.loans || [];
}

// Always mirrors to localStorage as an offline cache; cloud writes happen
// separately at each mutation site (see components/sheet.js, income.js, budgets.js).
export function saveData() {
  persist(DATA);
}

// Goal contributions and utang principal/repayments are logged as real
// transactions (so history stays accurate), but they're tracked separately
// from the main balance — Goals and Utang already have their own summaries,
// and mixing them into "Net Balance" makes that number mean something
// different depending on whether you happened to add to a goal that period.
export function isSeparatelyTracked(tx) {
  return !!(tx.goalId || tx.loanId);
}

// Kept name: monthTx. Now filters by the CURRENT PERIOD's date range
// (inclusive), not a calendar-month string prefix — a plain .startsWith()
// check would be wrong here (e.g. "2026-09-10" spuriously matches a
// .startsWith("2026-09-1") check meant for the 1st–15th period, while
// "2026-09-01" would NOT match that same broken check — range comparison on
// the ISO date strings is what actually works).
export function monthTx(type, { excludeSeparatelyTracked = true } = {}) {
  const { start, end } = periodRange(state.monthKey);
  return DATA.transactions.filter((t) => {
    if (t.type !== type || !t.date || t.date < start || t.date > end)
      return false;
    if (excludeSeparatelyTracked && isSeparatelyTracked(t)) return false;
    return true;
  });
}

export function totals() {
  const salary = Number(DATA.salary[state.monthKey]) || 0;
  const extraIncome = monthTx("income").reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
  );
  const totalIncome = salary + extraIncome;
  const totalExpense = monthTx("expense").reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
  );
  return {
    salary,
    extraIncome,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}

// Kept name: monthsBack. Returns N period keys going back from the current
// one (chronological order, oldest first) — used by the trend chart.
export function monthsBack(n) {
  const arr = [];
  let [y, m, half] = state.monthKey.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    arr.unshift(`${y}-${String(m).padStart(2, "0")}-${half}`);
    if (half === 1) {
      half = 2;
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    } else {
      half = 1;
    }
  }
  return arr;
}

export function trendTotals(periodKey) {
  const { start, end } = periodRange(periodKey);
  const salary = Number(DATA.salary[periodKey]) || 0;
  const extra = DATA.transactions
    .filter(
      (x) =>
        x.type === "income" &&
        x.date &&
        x.date >= start &&
        x.date <= end &&
        !isSeparatelyTracked(x),
    )
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const exp = DATA.transactions
    .filter(
      (x) =>
        x.type === "expense" &&
        x.date &&
        x.date >= start &&
        x.date <= end &&
        !isSeparatelyTracked(x),
    )
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  return { inc: salary + extra, exp };
}
