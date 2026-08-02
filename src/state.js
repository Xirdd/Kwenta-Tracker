import { loadData, persist } from "./storage.js";

export let DATA = { salary: {}, transactions: [], budgets: {} };

export const state = {
  monthKey: monthKeyOf(new Date()),
  tab: "overview",
  editingId: null,
};

export function initData() {
  DATA = loadData();
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
}

export function monthTx(type) {
  return DATA.transactions.filter(
    (t) => t.type === type && t.date && t.date.startsWith(state.monthKey),
  );
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
    .filter((x) => x.type === "income" && x.date && x.date.startsWith(mk))
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const exp = DATA.transactions
    .filter((x) => x.type === "expense" && x.date && x.date.startsWith(mk))
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  return { inc: salary + extra, exp };
}
