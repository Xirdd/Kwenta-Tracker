import { DATA, saveData } from "./state.js";
import { uid, currencySymbol } from "./format.js";
import { sumPesos } from "./money.js";
import {
  isCloudMode,
  cloudUpsertGoal,
  cloudDeleteGoal,
  cloudUpsertTransaction,
  cloudDeleteTransaction,
} from "./sync.js";
import { notifySyncError } from "./toast.js";

const GOAL_CATEGORY = "savings";

export function getGoal(id) {
  return DATA.goals.find((g) => g.id === id);
}

export function createGoal({ name, targetAmount, targetMonth }) {
  const goal = {
    id: uid(),
    name,
    targetAmount,
    targetMonth: targetMonth || undefined,
    active: true,
  };
  DATA.goals.push(goal);
  saveData();
  if (isCloudMode()) cloudUpsertGoal(goal).catch((e) => notifySyncError(e));
  return goal;
}

export function updateGoal(goal, { name, targetAmount, targetMonth }) {
  goal.name = name;
  goal.targetAmount = targetAmount;
  goal.targetMonth = targetMonth || undefined;
  saveData();
  if (isCloudMode()) cloudUpsertGoal(goal).catch((e) => notifySyncError(e));
}

// Deleting a goal also deletes its contribution transactions. They used to be
// left behind: invisible (goal transactions are excluded from every total and
// list) but still synced, exported to CSV and findable through search.
export function deleteGoal(id) {
  const linked = DATA.transactions.filter((t) => t.goalId === id);
  DATA.transactions = DATA.transactions.filter((t) => t.goalId !== id);
  DATA.goals = DATA.goals.filter((g) => g.id !== id);
  saveData();
  if (isCloudMode()) {
    cloudDeleteGoal(id).catch((e) => notifySyncError(e));
    linked.forEach((t) =>
      cloudDeleteTransaction(t.id).catch((e) => notifySyncError(e)),
    );
  }
}

// All contributions ever made toward a goal, regardless of which month is currently being viewed.
export function contributionsFor(goalId) {
  return DATA.transactions
    .filter((t) => t.goalId === goalId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Doesn't go through contributionsFor(): sorting just to add things up was
// wasted work on every goal card render.
export function savedAmount(goalId) {
  return sumPesos(
    DATA.transactions.filter((t) => t.goalId === goalId),
    (t) => t.amount,
  );
}

export function addContribution(goal, { amount, date }) {
  const tx = {
    id: uid(),
    type: "expense",
    desc: goal.name,
    amount,
    category: GOAL_CATEGORY,
    date,
    goalId: goal.id,
  };
  DATA.transactions.push(tx);
  saveData();
  if (isCloudMode())
    cloudUpsertTransaction(tx).catch((e) => notifySyncError(e));
  return tx;
}

export function removeContribution(tx) {
  DATA.transactions = DATA.transactions.filter((t) => t.id !== tx.id);
  saveData();
  if (isCloudMode())
    cloudDeleteTransaction(tx.id).catch((e) => notifySyncError(e));
}

// Goal target dates stay full calendar months ("by December") — deliberately
// NOT semi-monthly periods, since "by the 1st half of December" reads
// strangely for a long-range savings target. This is its own independent
// month-key function (bills.js has its own too) rather than importing
// state.js's period keys.
export function currentRealMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Whole months between two 'YYYY-MM' keys (can be negative if `to` is in the past).
export function monthsBetween(fromKey, toKey) {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// A friendly "save this much per month to hit the target on time" hint, or a
// past-due note. Returns null when there's nothing useful to say (no target
// month set, or the goal is already complete).
export function paceHint(goal) {
  const saved = savedAmount(goal.id);
  const remaining = goal.targetAmount - saved;
  if (remaining <= 0) return null;
  if (!goal.targetMonth) return null;

  const monthsLeft = monthsBetween(currentRealMonthKey(), goal.targetMonth);
  if (monthsLeft <= 0) {
    return `Target month has passed — still needs a bit more to finish.`;
  }
  const perMonth = remaining / monthsLeft;
  return `Save about ${perMonthLabel(perMonth)}/month to reach it by ${monthLabel(goal.targetMonth)}.`;
}

// Was a hardcoded "₱", ignoring the currency picked in Settings.
function perMonthLabel(n) {
  return currencySymbol() + Math.ceil(n).toLocaleString("en-US");
}
