import { loadData, persist } from "./storage.js";
import {
  isCloudMode,
  cloudLoadAll,
  cloudMigrateLocalDataIfEmpty,
} from "./sync.js";
import { asCentavos, sumCentavos } from "./money.js";

// Every money value in DATA (transaction/recurring/loan amounts, salary,
// budgets, bill estimates, goal targets) is an INTEGER NUMBER OF CENTAVOS.
export let DATA = {
  salary: {},
  transactions: [],
  budgets: {},
  recurring: [],
  bills: [],
  goals: [],
  loans: [],
};

export const state = {
  monthKey: monthKeyOf(new Date()),
  section: "overview", // bottom nav: 'overview' | 'goals' | 'loans'
  tab: "overview", // sub-tab used only when section === 'overview'
  editingId: null,
  expenseFilters: { query: "", category: null },
};

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

export function monthKeyOf(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function shiftMonth(delta) {
  const [y, m] = state.monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.monthKey = monthKeyOf(d);
  state.expenseFilters = { query: "", category: null };
}

// Goal contributions and utang principal/repayments are logged as real
// transactions (so history stays accurate), but they're tracked separately
// from the main balance — Goals and Utang already have their own summaries,
// and mixing them into "Net Balance" makes that number mean something
// different depending on whether you happened to add to a goal that month.
export function isSeparatelyTracked(tx) {
  return !!(tx.goalId || tx.loanId);
}

// type: 'income' | 'expense'. excludeSeparatelyTracked defaults to true,
// since almost every use of this (balance, trend, category breakdown,
// budgets) wants goal/utang movements left out. Pass false only for the
// raw Expenses/Income list views, which should still show everything.
export function monthTx(type, { excludeSeparatelyTracked = true } = {}) {
  return DATA.transactions.filter((t) => {
    if (t.type !== type || !t.date || !t.date.startsWith(state.monthKey))
      return false;
    if (excludeSeparatelyTracked && isSeparatelyTracked(t)) return false;
    return true;
  });
}

// All values returned are integer centavos — format only at the UI layer.
export function totals() {
  const salary = asCentavos(DATA.salary[state.monthKey]);
  const extraIncome = sumCentavos(monthTx("income"), (t) => t.amount);
  const totalIncome = salary + extraIncome;
  const totalExpense = sumCentavos(monthTx("expense"), (t) => t.amount);
  return {
    salary,
    extraIncome,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}

export function monthsBack(n) {
  const arr = [];
  const [y, m] = state.monthKey.split("-").map(Number);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    arr.push(monthKeyOf(d));
  }
  return arr;
}

export function trendTotals(mk) {
  const inMonth = (type) =>
    DATA.transactions.filter(
      (x) =>
        x.type === type &&
        x.date &&
        x.date.startsWith(mk) &&
        !isSeparatelyTracked(x),
    );
  const salary = asCentavos(DATA.salary[mk]);
  const extra = sumCentavos(inMonth("income"), (x) => x.amount);
  const exp = sumCentavos(inMonth("expense"), (x) => x.amount);
  return { inc: salary + extra, exp };
}
