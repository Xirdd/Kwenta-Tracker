import { DATA, saveData, periodRange } from "./state.js";
import { uid } from "./format.js";
import {
  isCloudMode,
  cloudUpsertTransaction,
  cloudUpsertRecurring,
  cloudDeleteRecurring,
} from "./sync.js";
import { notifySyncError } from "./toast.js";

function dayFromDate(dateStr) {
  const day = Number(dateStr.split("-")[2]);
  return Math.min(day, 31); // a real calendar day; clamped per-month at materialize time instead (see below), since "31" is valid in some months and not others
}

function periodKeyOfDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const half = d <= 15 ? 1 : 2;
  return `${y}-${String(m).padStart(2, "0")}-${half}`;
}

// A rule's day inherently determines which half of every month it belongs
// to (day <= 15 -> the 1st-15th period, day > 15 -> the 16th-end period) —
// there's no separate field for this, since the day alone is sufficient and
// keeping them in sync would just be one more thing to get wrong.
function halfForDay(day) {
  return day <= 15 ? 1 : 2;
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
    // Kept name: startMonth. Now holds a period key (periodKeyOfDate),
    // gating "don't create transactions for periods before this rule
    // existed" — same purpose as before, just period-grained instead of
    // month-grained. Existing rules synced before this change have an old
    // "YYYY-MM" value here; that still sorts correctly before any
    // "YYYY-MM-1"/"YYYY-MM-2" period key (verified: "2026-09" < "2026-09-1"),
    // so old rules keep firing normally without needing a data migration.
    startMonth: periodKeyOfDate(date),
    active: true,
  };
  DATA.recurring.push(rule);
  saveData();
  if (isCloudMode())
    cloudUpsertRecurring(rule).catch((e) => notifySyncError(e));
  return rule;
}

export function updateRecurringTemplate(rule, { desc, amount, category }) {
  rule.desc = desc;
  rule.amount = amount;
  rule.category = category;
  saveData();
  if (isCloudMode())
    cloudUpsertRecurring(rule).catch((e) => notifySyncError(e));
}

export function stopRecurringRule(id) {
  DATA.recurring = DATA.recurring.filter((r) => r.id !== id);
  saveData();
  if (isCloudMode()) cloudDeleteRecurring(id).catch((e) => notifySyncError(e));
}

// Makes sure every active recurring rule that belongs to this PERIOD (based
// on its day falling in the 1st-15th or 16th-end half) has a real
// transaction for it, creating one if it's missing. Safe to call repeatedly
// (idempotent). A rule whose day falls in the other half of the month
// simply doesn't fire while viewing this period — it'll fire once you
// navigate to its matching period instead, same as it only fired once a
// month before this change.
export function materializeMonth(periodKey) {
  let changed = false;
  const [y, m, half] = periodKey.split("-").map(Number);
  const { end } = periodRange(periodKey);
  const lastDayOfMonth = Number(end.split("-")[2]);

  DATA.recurring.forEach((rule) => {
    if (!rule.active) return;
    if (periodKey < rule.startMonth) return;
    if (halfForDay(rule.day) !== half) return; // belongs to the other half of this month

    const day = Math.min(rule.day, lastDayOfMonth); // clamp for short months (e.g. day 31 in a 30-day month)
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const alreadyExists = DATA.transactions.some(
      (t) => t.recurringId === rule.id && t.date === dateStr,
    );
    if (alreadyExists) return;

    const tx = {
      id: uid(),
      type: rule.type,
      desc: rule.desc,
      amount: rule.amount,
      category: rule.category,
      date: dateStr,
      recurringId: rule.id,
    };
    DATA.transactions.push(tx);
    changed = true;
    if (isCloudMode())
      cloudUpsertTransaction(tx).catch((e) => notifySyncError(e));
  });
  if (changed) saveData();
  return changed;
}
