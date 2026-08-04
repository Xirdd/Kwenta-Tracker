import { DATA, saveData } from "./state.js";
import { uid } from "./format.js";
import {
  isCloudMode,
  cloudUpsertTransaction,
  cloudUpsertRecurring,
  cloudDeleteRecurring,
} from "./sync.js";

function dayFromDate(dateStr) {
  const day = Number(dateStr.split("-")[2]);
  return Math.min(day, 28); // keeps it valid for every month, including February
}

function dateForMonth(monthKey, day) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function getRule(id) {
  return DATA.recurring.find((r) => r.id === id);
}

export function createRecurringRule({ type, desc, amount, category, date }) {
  const rule = {
    id: uid(),
    type,
    desc,
    amount,
    category,
    day: dayFromDate(date),
    startMonth: date.slice(0, 7),
    active: true,
  };
  DATA.recurring.push(rule);
  saveData();
  if (isCloudMode())
    cloudUpsertRecurring(rule).catch((e) =>
      console.error("Cloud sync failed", e),
    );
  return rule;
}

export function updateRecurringTemplate(rule, { desc, amount, category }) {
  rule.desc = desc;
  rule.amount = amount;
  rule.category = category;
  saveData();
  if (isCloudMode())
    cloudUpsertRecurring(rule).catch((e) =>
      console.error("Cloud sync failed", e),
    );
}

export function stopRecurringRule(id) {
  DATA.recurring = DATA.recurring.filter((r) => r.id !== id);
  saveData();
  if (isCloudMode())
    cloudDeleteRecurring(id).catch((e) =>
      console.error("Cloud sync failed", e),
    );
}

// Makes sure every active recurring rule has a real transaction for the given
// month, creating one if it's missing. Safe to call repeatedly (idempotent).
export function materializeMonth(monthKey) {
  let changed = false;
  DATA.recurring.forEach((rule) => {
    if (!rule.active) return;
    if (monthKey < rule.startMonth) return;
    const alreadyExists = DATA.transactions.some(
      (t) => t.recurringId === rule.id && t.date && t.date.startsWith(monthKey),
    );
    if (alreadyExists) return;

    const tx = {
      id: uid(),
      type: rule.type,
      desc: rule.desc,
      amount: rule.amount,
      category: rule.category,
      date: dateForMonth(monthKey, rule.day),
      recurringId: rule.id,
    };
    DATA.transactions.push(tx);
    changed = true;
    if (isCloudMode())
      cloudUpsertTransaction(tx).catch((e) =>
        console.error("Cloud sync failed", e),
      );
  });
  if (changed) saveData();
  return changed;
}
