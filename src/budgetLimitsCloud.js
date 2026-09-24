import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";
import { getActiveHouseholdId } from "./household.js";
import { registerRetryable, enqueueRetry } from "./syncQueue.js";

// Cloud side of the optional 16th–end budget limit (kwenta_budgets.amount_second,
// see supabase/budget_second_half.sql). Kept in its own file so it doesn't
// touch sync.js — the 1st–15th limit still goes through cloudUpsertBudget()
// exactly as before.

// Same scoping rule as sync.js: a household's rows, or my own personal rows.
function applyScope(query, householdId, userId) {
  return householdId
    ? query.eq("household_id", householdId)
    : query.eq("user_id", userId).is("household_id", null);
}

// { [category]: amount } for every category that has its own 2nd-half limit.
export async function cloudLoadBudgetsSecond() {
  const user = getCurrentUser();
  if (!supabase || !user) return {};
  const householdId = getActiveHouseholdId();

  const { data, error } = await applyScope(
    supabase.from("kwenta_budgets").select("category, amount_second"),
    householdId,
    user.id,
  );
  if (error) throw error;

  const out = {};
  (data || []).forEach((r) => {
    if (r.amount_second !== null && r.amount_second !== undefined) {
      out[r.category] = Number(r.amount_second);
    }
  });
  return out;
}

// Sets (or clears, when amount is null) the 2nd-half limit for one category.
// The row is normally there already (created by the 1st-half upsert). If it
// isn't — a category that only has a 2nd-half limit — one is created with
// amount = 0, which the app already treats as "no limit" for the 1st half.
async function upsertSecond({ category, amount, householdId, userId }) {
  if (!supabase) return;
  const clearing =
    amount === null || amount === undefined || Number.isNaN(Number(amount));

  const { data: existing, error: selectError } = await applyScope(
    supabase.from("kwenta_budgets").select("category"),
    householdId,
    userId,
  )
    .eq("category", category)
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await applyScope(
      supabase.from("kwenta_budgets").update({
        amount_second: clearing ? null : Number(amount),
        updated_at: new Date().toISOString(),
      }),
      householdId,
      userId,
    ).eq("category", category);
    if (error) throw error;
  } else if (!clearing) {
    const { error } = await supabase.from("kwenta_budgets").insert({
      user_id: userId,
      household_id: householdId,
      category,
      amount: 0,
      amount_second: Number(amount),
    });
    if (error) throw error;
  }
}

// Replayed by syncQueue.js (args are plain JSON) if a write fails offline.
registerRetryable("budgetSecondHalf", (args) => upsertSecond(args));

export async function cloudSetBudgetSecond(category, amount) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  const args = {
    category,
    amount: amount === undefined ? null : amount,
    householdId: getActiveHouseholdId(),
    userId: user.id,
  };
  try {
    await upsertSecond(args);
  } catch (e) {
    enqueueRetry("budgetSecondHalf", [args]);
    throw e; // callers surface it via notifySyncError, same as every other cloud write
  }
}
