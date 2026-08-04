import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";

export function isCloudMode() {
  return !!supabase && !!getCurrentUser();
}

// Loads everything for the signed-in user, shaped like the local DATA object.
export async function cloudLoadAll() {
  const user = getCurrentUser();
  if (!supabase || !user) return null;

  const [salaryRes, txRes, budgetRes, recurringRes] = await Promise.all([
    supabase.from("kwenta_salary").select("*").eq("user_id", user.id),
    supabase.from("kwenta_transactions").select("*").eq("user_id", user.id),
    supabase.from("kwenta_budgets").select("*").eq("user_id", user.id),
    supabase.from("kwenta_recurring").select("*").eq("user_id", user.id),
  ]);

  if (salaryRes.error) throw salaryRes.error;
  if (txRes.error) throw txRes.error;
  if (budgetRes.error) throw budgetRes.error;
  if (recurringRes.error) throw recurringRes.error;

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

  return { salary, transactions, budgets, recurring };
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
    type: tx.type,
    description: tx.desc || "",
    amount: tx.amount,
    category: tx.category,
    date: tx.date,
    recurring_id: tx.recurringId || null,
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

export async function cloudUpsertBudget(category, amount) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  if (amount === undefined || amount === null || isNaN(amount)) {
    await supabase
      .from("kwenta_budgets")
      .delete()
      .eq("user_id", user.id)
      .eq("category", category);
  } else {
    await supabase
      .from("kwenta_budgets")
      .upsert({ user_id: user.id, category, amount });
  }
}

export async function cloudUpsertRecurring(rule) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  await supabase.from("kwenta_recurring").upsert({
    id: rule.id,
    user_id: user.id,
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

// Called once, right after a successful sign-in. If the account has no cloud
// data yet, pushes whatever was saved locally so nothing gets lost. If the
// account already has cloud data, does nothing (cloud data wins).
export async function cloudMigrateLocalDataIfEmpty(localData) {
  const existing = await cloudLoadAll();
  if (!existing) return false;
  const isEmpty =
    Object.keys(existing.salary).length === 0 &&
    existing.transactions.length === 0 &&
    Object.keys(existing.budgets).length === 0 &&
    existing.recurring.length === 0;
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
  await Promise.all(jobs);
  return true;
}
