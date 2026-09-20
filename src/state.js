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

export const state = {
  monthKey: monthKeyOf(new Date()),
  section: "overview",
  tab: "overview",
  editingId: null,
  expenseFilters: { query: "", category: null },
};

export async function initData() {
  if (isCloudMode()) {
    const local = loadData();
    await cloudMigrateLocalDataIfEmpty(local);
    const cloud = await cloudLoadAll();
    replaceData(cloud || local);
  } else {
    replaceData(loadData());
  }
}

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

export function isSeparatelyTracked(tx) {
  return !!(tx.goalId || tx.loanId);
}

export function monthTx(type, { excludeSeparatelyTracked = true } = {}) {
  return DATA.transactions.filter((t) => {
    if (t.type !== type || !t.date || !t.date.startsWith(state.monthKey))
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
  const salary = Number(DATA.salary[mk]) || 0;
  const extra = DATA.transactions
    .filter(
      (x) =>
        x.type === "income" &&
        x.date &&
        x.date.startsWith(mk) &&
        !isSeparatelyTracked(x),
    )
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const exp = DATA.transactions
    .filter(
      (x) =>
        x.type === "expense" &&
        x.date &&
        x.date.startsWith(mk) &&
        !isSeparatelyTracked(x),
    )
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  return { inc: salary + extra, exp };
}
