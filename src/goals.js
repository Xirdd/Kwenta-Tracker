import { DATA, saveData, monthKeyOf } from "./state.js";
import { uid } from "./format.js";
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

export function deleteGoal(id) {
  DATA.goals = DATA.goals.filter((g) => g.id !== id);
  saveData();
  if (isCloudMode()) cloudDeleteGoal(id).catch((e) => notifySyncError(e));
}

// All contributions ever made toward a goal, regardless of which month is currently being viewed.
export function contributionsFor(goalId) {
  return DATA.transactions
    .filter((t) => t.goalId === goalId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function savedAmount(goalId) {
  return contributionsFor(goalId).reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
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

export function currentRealMonthKey() {
  return monthKeyOf(new Date());
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

function perMonthLabel(n) {
  return "₱" + Math.ceil(n).toLocaleString("en-US");
}
