import { loadData, persist } from "./storage.js";
import {
  isCloudMode,
  cloudLoadAll,
  cloudMigrateLocalDataIfEmpty,
} from "./sync.js";

export let DATA = {
  salary: {},
  transactions: [],
  budgets: {},
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

// Loads DATA from the cloud if signed in, otherwise from localStorage.
export async function initData() {
  if (isCloudMode()) {
    const local = loadData(); // in case this is the very first sign-in on this device
    await cloudMigrateLocalDataIfEmpty(local);
    const cloud = await cloudLoadAll();
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
    recurring: DATA.recurring,
    bills: DATA.bills,
    goals: DATA.goals,
    loans: DATA.loans,
  };
  await cloudMigrateLocalDataIfEmpty(local);
  const cloud = await cloudLoadAll();
  if (cloud) replaceData(cloud);
}

// Falls back to localStorage after a sign-out.
export function switchToLocalData() {
  replaceData(loadData());
}

function replaceData(next) {
  DATA.salary = next.salary || {};
  DATA.transactions = next.transactions || [];
  DATA.budgets = next.budgets || {};
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
