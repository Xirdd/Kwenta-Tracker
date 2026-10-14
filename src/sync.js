import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";
import { getActiveHouseholdId } from "./household.js";
import {
  registerRetryable,
  enqueueRetry,
  isTransientError,
} from "./syncQueue.js";

export function isCloudMode() {
  return !!supabase && !!getCurrentUser();
}

function scoped(table, user, householdId) {
  let q = supabase.from(table).select("*");
  return householdId
    ? q.eq("household_id", householdId)
    : q.eq("user_id", user.id).is("household_id", null);
}

// supabase-js does NOT throw on a failed request — it resolves with
// { data, error }. Every write below runs its result through this, so a
// failure becomes a real rejected promise and the callers' existing
// `.catch(notifySyncError)` actually fires.
function check(result) {
  if (result && result.error) throw result.error;
  return result;
}

// HOUSEHOLD OWNERSHIP
// Shared tables are keyed by (user_id, id): the row belongs to whoever
// CREATED it, even when the whole household can see and edit it. Loaded
// objects therefore carry `userId`, and every write sends the row's real
// owner. Previously every write used the CURRENT user's id, so:
//   - editing a row another member created inserted a second copy under
//     YOUR id (the original stayed, so the entry appeared twice), and
//   - deleting it matched nothing (filtered by your id) and the entry came
//     back on the next reload.
const ownerOf = (item, user) => item.userId || user.id;

// ── Raw executors ────────────────────────────────────────────────────────
// Each takes plain-JSON arguments (the user id / household id are captured
// by the caller at the moment of the edit, NOT looked up again at replay
// time), so the retry queue can store and replay them safely later.
async function rawUpsert(table, row) {
  check(await supabase.from(table).upsert(row));
}

// Kept for salary rows and for any "deleteRow" jobs already sitting in a
// device's retry queue from an older version.
async function rawDelete(table, match) {
  let q = supabase.from(table).delete();
  for (const [col, val] of Object.entries(match)) q = q.eq(col, val);
  check(await q);
}

// Deletes one row by id, scoped exactly like loads are: a household's rows,
// or my own personal rows. Row Level Security still decides what is allowed.
async function rawDeleteById({ table, id, householdId, userId }) {
  let q = supabase.from(table).delete().eq("id", id);
  q = householdId
    ? q.eq("household_id", householdId)
    : q.eq("user_id", userId).is("household_id", null);
  check(await q);
}

// Budgets are a special case (primary key is (user_id, category), so a
// household's dedupe lives here instead of in a DB constraint).
async function rawBudget({ category, amount, householdId, userId }) {
  const clearing =
    amount === undefined || amount === null || Number.isNaN(Number(amount));

  if (householdId) {
    const { data: existing, error: selectError } = await supabase
      .from("kwenta_budgets")
      .select("user_id")
      .eq("household_id", householdId)
      .eq("category", category)
      .maybeSingle();
    if (selectError) throw selectError;

    if (clearing) {
      if (existing)
        check(
          await supabase
            .from("kwenta_budgets")
            .delete()
            .eq("household_id", householdId)
            .eq("category", category),
        );
      return;
    }
    if (existing) {
      check(
        await supabase
          .from("kwenta_budgets")
          .update({ amount, updated_at: new Date().toISOString() })
          .eq("household_id", householdId)
          .eq("category", category),
      );
    } else {
      check(
        await supabase.from("kwenta_budgets").insert({
          user_id: userId,
          household_id: householdId,
          category,
          amount,
        }),
      );
    }
    return;
  }

  if (clearing) {
    check(
      await supabase
        .from("kwenta_budgets")
        .delete()
        .eq("user_id", userId)
        .eq("category", category)
        .is("household_id", null),
    );
  } else {
    check(
      await supabase
        .from("kwenta_budgets")
        .upsert({ user_id: userId, category, amount, household_id: null }),
    );
  }
}

// Wraps a raw executor: on a TRANSIENT failure (offline, server hiccup) the
// call is queued for automatic retry and the error is still thrown so the
// person sees the toast. Permanent failures (permissions, constraint
// violations) are thrown but NOT queued — retrying them forever can't help.
function withRetry(kind, raw) {
  registerRetryable(kind, raw);
  return async (...args) => {
    try {
      await raw(...args);
    } catch (e) {
      if (isTransientError(e)) enqueueRetry(kind, args);
      throw e;
    }
  };
}

const upsertRow = withRetry("upsertRow", rawUpsert);
const deleteRow = withRetry("deleteRow", rawDelete);
const deleteById = withRetry("deleteById", rawDeleteById);
const writeBudget = withRetry("budget", rawBudget);

function removeById(table, id) {
  const user = getCurrentUser();
  if (!supabase || !user) return Promise.resolve();
  return deleteById({
    table,
    id,
    householdId: getActiveHouseholdId(),
    userId: user.id,
  });
}

// ── Load ────────────────────────────────────────────────────────────────
export async function cloudLoadAll() {
  const user = getCurrentUser();
  if (!supabase || !user) return null;
  const householdId = getActiveHouseholdId();

  const [
    salaryRes,
    txRes,
    budgetRes,
    recurringRes,
    billsRes,
    goalsRes,
    loansRes,
    walletsRes,
  ] = await Promise.all([
    supabase.from("kwenta_salary").select("*").eq("user_id", user.id),
    scoped("kwenta_transactions", user, householdId),
    scoped("kwenta_budgets", user, householdId),
    scoped("kwenta_recurring", user, householdId),
    scoped("kwenta_bills", user, householdId),
    scoped("kwenta_goals", user, householdId),
    scoped("kwenta_loans", user, householdId),
    scoped("kwenta_wallets", user, householdId),
  ]);

  [
    salaryRes,
    txRes,
    budgetRes,
    recurringRes,
    billsRes,
    goalsRes,
    loansRes,
    walletsRes,
  ].forEach(check);

  const salary = {};
  (salaryRes.data || []).forEach((r) => {
    salary[r.month_key] = Number(r.amount);
  });

  const transactions = (txRes.data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    desc: r.description || "",
    amount: Number(r.amount),
    category: r.category,
    date: r.date,
    recurringId: r.recurring_id || undefined,
    billId: r.bill_id || undefined,
    goalId: r.goal_id || undefined,
    loanId: r.loan_id || undefined,
    loanKind: r.loan_kind || undefined,
    walletId: r.wallet_id || undefined,
    tags: r.tags && r.tags.length ? r.tags : undefined,
  }));

  const budgets = {};
  (budgetRes.data || []).forEach((r) => {
    budgets[r.category] = Number(r.amount);
  });

  const recurring = (recurringRes.data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    desc: r.description || "",
    amount: Number(r.amount),
    category: r.category,
    day: r.day_of_month,
    startMonth: r.start_month,
    active: r.active,
  }));

  const bills = (billsRes.data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    category: r.category,
    customCategory: r.custom_category || undefined,
    dueDay: r.due_day,
    estimatedAmount:
      r.estimated_amount === null ? undefined : Number(r.estimated_amount),
    active: r.active,
  }));

  const goals = (goalsRes.data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    targetAmount: Number(r.target_amount),
    targetMonth: r.target_month || undefined,
    active: r.active,
  }));

  const loans = (loansRes.data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    person: r.person,
    direction: r.direction,
    amount: Number(r.amount),
    date: r.date,
    note: r.note || undefined,
    active: r.active,
  }));

  const wallets = (walletsRes.data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    provider: r.provider || "other",
    startingBalance: Number(r.starting_balance) || 0,
    active: r.active,
  }));

  return {
    salary,
    transactions,
    budgets,
    recurring,
    bills,
    goals,
    loans,
    wallets,
  };
}

// ── Salary ──────────────────────────────────────────────────────────────
export async function cloudUpsertSalary(monthKey, amount) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  if (amount === undefined || amount === null || isNaN(amount)) {
    await deleteRow("kwenta_salary", { user_id: user.id, month_key: monthKey });
  } else {
    await upsertRow("kwenta_salary", {
      user_id: user.id,
      month_key: monthKey,
      amount,
    });
  }
}

// ── Transactions ────────────────────────────────────────────────────────
export async function cloudUpsertTransaction(tx) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await upsertRow("kwenta_transactions", {
    id: tx.id,
    user_id: ownerOf(tx, user),
    household_id: getActiveHouseholdId(),
    type: tx.type,
    description: tx.desc || "",
    amount: tx.amount,
    category: tx.category,
    date: tx.date,
    recurring_id: tx.recurringId || null,
    bill_id: tx.billId || null,
    goal_id: tx.goalId || null,
    loan_id: tx.loanId || null,
    loan_kind: tx.loanKind || null,
    wallet_id: tx.walletId || null,
    tags: tx.tags && tx.tags.length ? tx.tags : null,
  });
}

export async function cloudDeleteTransaction(id) {
  await removeById("kwenta_transactions", id);
}

// ── Budgets ─────────────────────────────────────────────────────────────
export async function cloudUpsertBudget(category, amount) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await writeBudget({
    category,
    amount: amount === undefined ? null : amount,
    householdId: getActiveHouseholdId(),
    userId: user.id,
  });
}

// ── Recurring ───────────────────────────────────────────────────────────
export async function cloudUpsertRecurring(rule) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await upsertRow("kwenta_recurring", {
    id: rule.id,
    user_id: ownerOf(rule, user),
    household_id: getActiveHouseholdId(),
    type: rule.type,
    description: rule.desc || "",
    amount: rule.amount,
    category: rule.category,
    day_of_month: rule.day,
    start_month: rule.startMonth,
    active: rule.active,
  });
}

export async function cloudDeleteRecurring(id) {
  await removeById("kwenta_recurring", id);
}

// ── Bills ───────────────────────────────────────────────────────────────
export async function cloudUpsertBill(bill) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await upsertRow("kwenta_bills", {
    id: bill.id,
    user_id: ownerOf(bill, user),
    household_id: getActiveHouseholdId(),
    name: bill.name,
    category: bill.category,
    custom_category: bill.customCategory || null,
    due_day: bill.dueDay,
    estimated_amount:
      bill.estimatedAmount === undefined ? null : bill.estimatedAmount,
    active: bill.active,
  });
}

export async function cloudDeleteBill(id) {
  await removeById("kwenta_bills", id);
}

// ── Goals ───────────────────────────────────────────────────────────────
export async function cloudUpsertGoal(goal) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await upsertRow("kwenta_goals", {
    id: goal.id,
    user_id: ownerOf(goal, user),
    household_id: getActiveHouseholdId(),
    name: goal.name,
    target_amount: goal.targetAmount,
    target_month: goal.targetMonth || null,
    active: goal.active,
  });
}

export async function cloudDeleteGoal(id) {
  await removeById("kwenta_goals", id);
}

// ── Loans (utang) ───────────────────────────────────────────────────────
export async function cloudUpsertLoan(loan) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await upsertRow("kwenta_loans", {
    id: loan.id,
    user_id: ownerOf(loan, user),
    household_id: getActiveHouseholdId(),
    person: loan.person,
    direction: loan.direction,
    amount: loan.amount,
    date: loan.date,
    note: loan.note || null,
    active: loan.active,
  });
}

export async function cloudDeleteLoan(id) {
  await removeById("kwenta_loans", id);
}

// ── Wallets (GCash, GoTyme, Maribank, …) ───────────────────────────────
export async function cloudUpsertWallet(wallet) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await upsertRow("kwenta_wallets", {
    id: wallet.id,
    user_id: ownerOf(wallet, user),
    household_id: getActiveHouseholdId(),
    name: wallet.name,
    provider: wallet.provider || "other",
    starting_balance: wallet.startingBalance || 0,
    active: wallet.active,
  });
}

export async function cloudDeleteWallet(id) {
  await removeById("kwenta_wallets", id);
}

// ── First sign-in: push local data up if the account is empty ──────────
// Local objects may carry a `userId` from an earlier cloud load (they're kept
// in the on-device cache). It must be dropped here: this data is being
// adopted by the CURRENT account, and writing another user's id would be
// refused by Row Level Security.
const adopt = (item) => ({ ...item, userId: undefined });

export async function cloudMigrateLocalDataIfEmpty(localData) {
  const existing = await cloudLoadAll();
  if (!existing) return false;
  const isEmpty =
    Object.keys(existing.salary).length === 0 &&
    existing.transactions.length === 0 &&
    Object.keys(existing.budgets).length === 0 &&
    existing.recurring.length === 0 &&
    existing.bills.length === 0 &&
    existing.goals.length === 0 &&
    existing.loans.length === 0 &&
    existing.wallets.length === 0;
  if (!isEmpty) return false;

  const jobs = [];
  Object.entries(localData.salary || {}).forEach(([mk, amt]) => {
    if (amt) jobs.push(cloudUpsertSalary(mk, amt));
  });
  (localData.transactions || []).forEach((tx) =>
    jobs.push(cloudUpsertTransaction(adopt(tx))),
  );
  Object.entries(localData.budgets || {}).forEach(([cat, amt]) => {
    if (amt) jobs.push(cloudUpsertBudget(cat, amt));
  });
  (localData.recurring || []).forEach((rule) =>
    jobs.push(cloudUpsertRecurring(adopt(rule))),
  );
  (localData.bills || []).forEach((bill) =>
    jobs.push(cloudUpsertBill(adopt(bill))),
  );
  (localData.goals || []).forEach((goal) =>
    jobs.push(cloudUpsertGoal(adopt(goal))),
  );
  (localData.loans || []).forEach((loan) =>
    jobs.push(cloudUpsertLoan(adopt(loan))),
  );
  (localData.wallets || []).forEach((wallet) =>
    jobs.push(cloudUpsertWallet(adopt(wallet))),
  );
  await Promise.all(jobs);
  return true;
}
