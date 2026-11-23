import { DATA, saveData } from "./state.js";
import { uid } from "./format.js";
import { sumPesos } from "./money.js";
import { currentRealMonthKey, daysUntil } from "./bills.js";
import {
  isCloudMode,
  cloudUpsertInstallment,
  cloudDeleteInstallment,
  cloudUpsertTransaction,
  cloudDeleteTransaction,
} from "./sync.js";
import { notifySyncError } from "./toast.js";

// Installment plans (SPayLater and similar).
//
// A plan is a template; each month's payment is a REAL expense in the
// built-in "installments" category, linked back by `installmentId` (the same
// idea as bills and billId). That is what makes monthly dues show up in the
// Overview totals and count against an "Installments / SPayLater" budget.
//
//   remainingMonths = payments still to make. Paying one lowers it by 1;
//   undoing a payment raises it by 1. A plan at 0 is completed.
//   "Month 2 of 6"  = (totalMonths - remainingMonths) + 1.

export const INSTALLMENT_CATEGORY = "installments";

// Matches Shopee SPayLater cycles.
export const DUE_RULES = [
  { id: "15th", label: "15th of the month", short: "15th" },
  { id: "last", label: "Last day of the month", short: "Month end" },
];
const RULE_IDS = DUE_RULES.map((r) => r.id);
const DEFAULT_RULE = "last";

export function getInstallment(id) {
  return DATA.installments.find((p) => p.id === id);
}

// Every list and total reads plans through here. If the same plan ever ends up
// in DATA twice (a double tap on Save, or a sync echo), it is shown once.
export function uniquePlans() {
  const seen = new Set();
  return DATA.installments.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// ── Due dates ───────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function daysInMonth(y, m /* 1-indexed */) {
  return new Date(y, m, 0).getDate();
}

export function dueDayFor(rule, monthKey) {
  if (rule === "15th") return 15;
  const [y, m] = monthKey.split("-").map(Number);
  return daysInMonth(y, m); // 28/29/30/31, so "last day" is always real
}

// "YYYY-MM-DD" for the plan's due date in the given "YYYY-MM" month.
export function dueDateFor(rule, monthKey) {
  return `${monthKey}-${pad(dueDayFor(rule, monthKey))}`;
}

export function dueRuleLabel(rule, { short = false } = {}) {
  const found = DUE_RULES.find((r) => r.id === rule) || DUE_RULES[1];
  return short ? found.short : found.label;
}

export function nextMonthKey(monthKey) {
  let [y, m] = monthKey.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${pad(m)}`;
}

// ── Create / edit / delete ──────────────────────────────────────────────
function clampInt(n, min, max) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(Math.max(v, min), max);
}

// Cleans form input into the stored shape. Remaining months defaults to the
// full term and can never exceed it.
function normalize(f) {
  const totalMonths = clampInt(f.totalMonths, 1, 120);
  const hasRemaining =
    f.remainingMonths !== undefined &&
    f.remainingMonths !== null &&
    f.remainingMonths !== "";
  return {
    name: String(f.name || "").trim(),
    totalAmount: Number(f.totalAmount) || 0,
    monthlyAmount: Number(f.monthlyAmount) || 0,
    totalMonths,
    remainingMonths: hasRemaining
      ? clampInt(f.remainingMonths, 0, totalMonths)
      : totalMonths,
    dueRule: RULE_IDS.includes(f.dueRule) ? f.dueRule : DEFAULT_RULE,
  };
}

export function createInstallment(fields) {
  const clean = normalize(fields);
  // A second tap on Save a moment later would otherwise add the same plan again.
  const twin = DATA.installments.find(
    (p) =>
      Date.now() - Number(String(p.id).slice(3, 16)) < 5000 &&
      p.name === clean.name &&
      p.totalAmount === clean.totalAmount &&
      p.monthlyAmount === clean.monthlyAmount &&
      p.totalMonths === clean.totalMonths &&
      p.dueRule === clean.dueRule,
  );
  if (twin) return twin;
  const plan = { id: uid("ins"), ...clean, active: true };
  DATA.installments.push(plan);
  saveData();
  if (isCloudMode())
    cloudUpsertInstallment(plan).catch((e) => notifySyncError(e));
  return plan;
}

export function updateInstallment(plan, fields) {
  Object.assign(plan, normalize(fields));
  saveData();
  if (isCloudMode())
    cloudUpsertInstallment(plan).catch((e) => notifySyncError(e));
}

// Past payments are real expenses and stay in the history, same convention as
// deleting a bill. They just stop being linked to a plan that no longer exists.
export function deleteInstallment(id) {
  DATA.installments = DATA.installments.filter((p) => p.id !== id);
  saveData();
  if (isCloudMode())
    cloudDeleteInstallment(id).catch((e) => notifySyncError(e));
}

// ── Progress ────────────────────────────────────────────────────────────
export function paidCount(plan) {
  return Math.max(0, plan.totalMonths - plan.remainingMonths);
}

export function isActive(plan) {
  return plan.active !== false && plan.remainingMonths > 0;
}

export function progressLabel(plan) {
  if (plan.remainingMonths <= 0) return "Completed";
  return `Month ${Math.min(plan.totalMonths, paidCount(plan) + 1)} of ${plan.totalMonths}`;
}

export function progressPercent(plan) {
  return plan.totalMonths > 0
    ? Math.min(100, (paidCount(plan) / plan.totalMonths) * 100)
    : 0;
}

// What is still owed: remaining payments at the monthly amount.
export function remainingBalance(plan) {
  return sumPesos(
    Array.from({ length: plan.remainingMonths }),
    () => plan.monthlyAmount,
  );
}

// ── Payments ────────────────────────────────────────────────────────────
export function paymentsFor(planId) {
  return DATA.transactions
    .filter((t) => t.installmentId === planId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function findPayment(planId, monthKey) {
  return DATA.transactions.find(
    (t) => t.installmentId === planId && t.date && t.date.startsWith(monthKey),
  );
}

export function markInstallmentPaid(plan, { amount, date, walletId }) {
  // One payment per plan per month: a double tap on "Mark as paid" must not
  // record a second expense (that doubled the totals) or use up two months.
  const already = findPayment(plan.id, String(date).slice(0, 7));
  if (already) return already;
  const tx = {
    id: uid(),
    type: "expense",
    desc: plan.name,
    amount,
    category: INSTALLMENT_CATEGORY,
    date,
    installmentId: plan.id,
    walletId: walletId || undefined,
  };
  DATA.transactions.push(tx);
  plan.remainingMonths = Math.max(0, plan.remainingMonths - 1);
  saveData();
  if (isCloudMode()) {
    cloudUpsertTransaction(tx).catch((e) => notifySyncError(e));
    cloudUpsertInstallment(plan).catch((e) => notifySyncError(e));
  }
  return tx;
}

export function undoInstallmentPayment(tx) {
  const plan = getInstallment(tx.installmentId);
  DATA.transactions = DATA.transactions.filter((t) => t.id !== tx.id);
  if (plan)
    plan.remainingMonths = Math.min(plan.totalMonths, plan.remainingMonths + 1);
  saveData();
  if (isCloudMode()) {
    cloudDeleteTransaction(tx.id).catch((e) => notifySyncError(e));
    if (plan) cloudUpsertInstallment(plan).catch((e) => notifySyncError(e));
  }
}

// ── This month ──────────────────────────────────────────────────────────
// Plans that matter for a calendar month: still running, or paid that month.
// Sorted by due date. `daysLeft` is negative once overdue.
export function monthlyDues(monthKey = currentRealMonthKey()) {
  return uniquePlans()
    .filter((p) => p.active !== false)
    .map((plan) => ({
      plan,
      paidTx: findPayment(plan.id, monthKey),
      due: dueDateFor(plan.dueRule, monthKey),
    }))
    .filter(({ plan, paidTx }) => paidTx || plan.remainingMonths > 0)
    .map((d) => ({ ...d, daysLeft: daysUntil(d.due) }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

// The figures behind the Overview card and the Installments summary strip.
//   dueTotal    every plan's payment this month, paid or not
//   paidTotal   what has actually been paid this month
//   toPayTotal  still unpaid this month
//   balance     what is left across all running plans
export function installmentTotals(monthKey = currentRealMonthKey()) {
  const dues = monthlyDues(monthKey);
  const paid = dues.filter((d) => d.paidTx);
  const unpaid = dues.filter((d) => !d.paidTx);
  return {
    count: dues.length,
    dueTotal: sumPesos(dues, (d) => d.paidTx?.amount ?? d.plan.monthlyAmount),
    paidTotal: sumPesos(paid, (d) => d.paidTx.amount),
    toPayTotal: sumPesos(unpaid, (d) => d.plan.monthlyAmount),
    balance: sumPesos(
      uniquePlans().filter((p) => p.active !== false),
      (p) => remainingBalance(p),
    ),
  };
}

// The next date a payment is expected, for sorting: this month's due date
// until it is paid, then next month's. Completed plans have none.
export function nextDueDate(plan) {
  if (!isActive(plan)) return null;
  const now = currentRealMonthKey();
  const key = findPayment(plan.id, now) ? nextMonthKey(now) : now;
  return dueDateFor(plan.dueRule, key);
}
