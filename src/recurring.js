import { DATA, saveData, periodRange, periodKeyHasHalf } from "./state.js";
import { uid } from "./format.js";
import { getPeriodMode } from "./periodMode.js";
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

// The period key a date belongs to, in whichever mode is CURRENTLY selected
// at the moment the rule is created — same "today, in the current shape"
// idea as state.js's periodKeyOf(), just built from a "YYYY-MM-DD" string
// directly (avoiding a `new Date(dateStr)` round-trip and its timezone
// pitfalls) rather than importing that function itself.
function periodKeyOfDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  if (getPeriodMode() === "monthly") return `${y}-${mm}`;
  const half = d <= 15 ? 1 : 2;
  return `${y}-${mm}-${half}`;
}

// A rule's day inherently determines which half of every month it belongs
// to (day <= 15 -> the 1st-15th period, day > 15 -> the 16th-end period) —
// there's no separate field for this, since the day alone is sufficient and
// keeping them in sync would just be one more thing to get wrong. Only
// meaningful in semi-monthly mode; materializeMonth() below skips this
// check entirely for a monthly-mode period key.
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
    // Kept name: startMonth. Holds a period key in whichever mode was active
    // when the rule was created — gating "don't create transactions for
    // periods before this rule existed". A rule created in monthly mode has
    // a 2-segment startMonth ("2026-09"); one created in semi-monthly mode
    // has a 3-segment one ("2026-09-1"). String comparison against a
    // DIFFERENTLY-shaped periodKey in materializeMonth() below still sorts
    // sensibly (a "2026-09" prefix always compares before "2026-09-1" or
    // "2026-09-2" — the exact same cross-format tolerance this app already
    // relied on for the original monthly-to-semi-monthly migration), so
    // switching modes after a rule exists doesn't stop it from firing.
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

// Makes sure every active recurring rule due this PERIOD has a real
// transaction for it, creating one if it's missing. Safe to call repeatedly
// (idempotent).
//
// In semi-monthly mode (a 3-segment periodKey), a rule only fires in the
// half its day falls into — the other half simply doesn't materialize it,
// same as before this setting existed. In monthly mode (a 2-segment
// periodKey), there's no "other half" to skip: every active rule fires once
// for the month regardless of which half its day would have landed in.
export function materializeMonth(periodKey) {
  let changed = false;
  const isHalfMonth = periodKeyHasHalf(periodKey);
  const parts = periodKey.split("-").map(Number);
  const [y, m, half] = parts;
  const { end } = periodRange(periodKey);
  const lastDayOfMonth = Number(end.split("-")[2]);

  DATA.recurring.forEach((rule) => {
    if (!rule.active) return;
    if (periodKey < rule.startMonth) return;
    if (isHalfMonth && halfForDay(rule.day) !== half) return; // belongs to the other half of this month

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
