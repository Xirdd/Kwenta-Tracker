import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";
import { getActiveHouseholdId } from "./household.js";

export function isCloudMode() {
  return !!supabase && !!getCurrentUser();
}

// Applies the "personal vs household" scope to a SELECT query for any of the
// shareable tables (everything except kwenta_salary, which is always personal).
function scoped(table, user, householdId) {
  let q = supabase.from(table).select("*");
  return householdId
    ? q.eq("household_id", householdId)
    : q.eq("user_id", user.id).is("household_id", null);
}

// Loads everything for the signed-in user, shaped like the local DATA object.
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
  ] = await Promise.all([
    supabase.from("kwenta_salary").select("*").eq("user_id", user.id), // always personal, never shared
    scoped("kwenta_transactions", user, householdId),
    scoped("kwenta_budgets", user, householdId),
    scoped("kwenta_recurring", user, householdId),
    scoped("kwenta_bills", user, householdId),
    scoped("kwenta_goals", user, householdId),
    scoped("kwenta_loans", user, householdId),
  ]);

  if (salaryRes.error) throw salaryRes.error;
  if (txRes.error) throw txRes.error;
  if (budgetRes.error) throw budgetRes.error;
  if (recurringRes.error) throw recurringRes.error;
  if (billsRes.error) throw billsRes.error;
  if (goalsRes.error) throw goalsRes.error;
  if (loansRes.error) throw loansRes.error;

  const salary = {};
  (salaryRes.data || []).forEach((r) => {
    salary[r.month_key] = Number(r.amount);
  });

  const transactions = (txRes.data || []).map((r) => ({
    id: r.id,
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
  }));

  const budgets = {};
  (budgetRes.data || []).forEach((r) => {
    budgets[r.category] = Number(r.amount);
  });

  const recurring = (recurringRes.data || []).map((r) => ({
    id: r.id,
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
    name: r.name,
    targetAmount: Number(r.target_amount),
    targetMonth: r.target_month || undefined,
    active: r.active,
  }));

  const loans = (loansRes.data || []).map((r) => ({
    id: r.id,
    person: r.person,
    direction: r.direction,
    amount: Number(r.amount),
    date: r.date,
    note: r.note || undefined,
    active: r.active,
  }));

  return { salary, transactions, budgets, recurring, bills, goals, loans };
}

export async function cloudUpsertSalary(monthKey, amount) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  if (amount === undefined || amount === null || isNaN(amount)) {
    await supabase
      .from("kwenta_salary")
      .delete()
      .eq("user_id", user.id)
      .eq("month_key", monthKey);
  } else {
    await supabase
      .from("kwenta_salary")
      .upsert({ user_id: user.id, month_key: monthKey, amount });
  }
}

export async function cloudUpsertTransaction(tx) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase.from("kwenta_transactions").upsert({
    id: tx.id,
    user_id: user.id,
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
  });
}

export async function cloudDeleteTransaction(id) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase
    .from("kwenta_transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
}

// Budgets are the one table without a database-level unique constraint on
// (household_id, category) — the primary key stays (user_id, category) so
// no schema surgery was needed on an existing table. Instead we look up any
// existing row for the current scope and update it, or insert a fresh one.
export async function cloudUpsertBudget(category, amount) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  const householdId = getActiveHouseholdId();

  if (householdId) {
    const { data: existing } = await supabase
      .from("kwenta_budgets")
      .select("user_id")
      .eq("household_id", householdId)
      .eq("category", category)
      .maybeSingle();

    if (amount === undefined || amount === null || isNaN(amount)) {
      if (existing)
        await supabase
          .from("kwenta_budgets")
          .delete()
          .eq("household_id", householdId)
          .eq("category", category);
      return;
    }
    if (existing) {
      await supabase
        .from("kwenta_budgets")
        .update({ amount, updated_at: new Date().toISOString() })
        .eq("household_id", householdId)
        .eq("category", category);
    } else {
      await supabase
        .from("kwenta_budgets")
        .insert({
          user_id: user.id,
          household_id: householdId,
          category,
          amount,
        });
    }
    return;
  }

  // Personal (no household) — original behavior.
  if (amount === undefined || amount === null || isNaN(amount)) {
    await supabase
      .from("kwenta_budgets")
      .delete()
      .eq("user_id", user.id)
      .eq("category", category)
      .is("household_id", null);
  } else {
    await supabase
      .from("kwenta_budgets")
      .upsert({ user_id: user.id, category, amount, household_id: null });
  }
}

export async function cloudUpsertRecurring(rule) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase.from("kwenta_recurring").upsert({
    id: rule.id,
    user_id: user.id,
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
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase
    .from("kwenta_recurring")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
}

export async function cloudUpsertBill(bill) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase.from("kwenta_bills").upsert({
    id: bill.id,
    user_id: user.id,
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
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase
    .from("kwenta_bills")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
}

export async function cloudUpsertGoal(goal) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase.from("kwenta_goals").upsert({
    id: goal.id,
    user_id: user.id,
    household_id: getActiveHouseholdId(),
    name: goal.name,
    target_amount: goal.targetAmount,
    target_month: goal.targetMonth || null,
    active: goal.active,
  });
}

export async function cloudDeleteGoal(id) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase
    .from("kwenta_goals")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
}

export async function cloudUpsertLoan(loan) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase.from("kwenta_loans").upsert({
    id: loan.id,
    user_id: user.id,
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
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase
    .from("kwenta_loans")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
}

// Called once, right after a successful sign-in. If the account has no cloud
// data yet for the current scope (personal, or the household it just joined),
// pushes whatever was saved locally so nothing gets lost. If data already
// exists there, does nothing (cloud data wins).
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
    existing.loans.length === 0;
  if (!isEmpty) return false;

  const jobs = [];
  Object.entries(localData.salary || {}).forEach(([mk, amt]) => {
    if (amt) jobs.push(cloudUpsertSalary(mk, amt));
  });
  (localData.transactions || []).forEach((tx) =>
    jobs.push(cloudUpsertTransaction(tx)),
  );
  Object.entries(localData.budgets || {}).forEach(([cat, amt]) => {
    if (amt) jobs.push(cloudUpsertBudget(cat, amt));
  });
  (localData.recurring || []).forEach((rule) =>
    jobs.push(cloudUpsertRecurring(rule)),
  );
  (localData.bills || []).forEach((bill) => jobs.push(cloudUpsertBill(bill)));
  (localData.goals || []).forEach((goal) => jobs.push(cloudUpsertGoal(goal)));
  (localData.loans || []).forEach((loan) => jobs.push(cloudUpsertLoan(loan)));
  await Promise.all(jobs);
  return true;
}
