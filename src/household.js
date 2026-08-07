import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";

let activeHousehold = null; // { id, name, inviteCode } | null
const listeners = [];

export function getActiveHousehold() {
  return activeHousehold;
}

export function getActiveHouseholdId() {
  return activeHousehold ? activeHousehold.id : null;
}

// Fired whenever the active household changes (loaded, created, joined, left).
export function onHouseholdChange(cb) {
  listeners.push(cb);
}

function setActiveHousehold(h) {
  activeHousehold = h;
  listeners.forEach((cb) => cb(activeHousehold));
}

function requireSupabase() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
    );
}

// Call after sign-in (and once on startup if already signed in) to find out
// whether the current user belongs to a household.
export async function loadActiveHousehold() {
  const user = getCurrentUser();
  if (!supabase || !user) {
    setActiveHousehold(null);
    return null;
  }
  const { data, error } = await supabase
    .from("kwenta_household_members")
    .select("household_id, kwenta_households(id, name, invite_code)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.kwenta_households) {
    setActiveHousehold(null);
    return null;
  }
  const h = {
    id: data.kwenta_households.id,
    name: data.kwenta_households.name,
    inviteCode: data.kwenta_households.invite_code,
  };
  setActiveHousehold(h);
  return h;
}

export async function createHousehold(name, { migrate = true } = {}) {
  requireSupabase();
  const { data, error } = await supabase.rpc("create_household", {
    household_name: name,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const h = { id: row.id, name: row.name, inviteCode: row.invite_code };
  setActiveHousehold(h);
  if (migrate) await migratePersonalDataToHousehold(h.id);
  return h;
}

export async function joinHousehold(code, { migrate = true } = {}) {
  requireSupabase();
  const { error } = await supabase.rpc("join_household_by_code", { code });
  if (error) throw error;
  const h = await loadActiveHousehold();
  if (migrate && h) await migratePersonalDataToHousehold(h.id);
  return h;
}

export async function leaveHousehold() {
  requireSupabase();
  const user = getCurrentUser();
  const h = activeHousehold;
  if (!user || !h) return;
  const { error } = await supabase
    .from("kwenta_household_members")
    .delete()
    .eq("household_id", h.id)
    .eq("user_id", user.id);
  if (error) throw error;
  setActiveHousehold(null);
}

// Shares your existing personal data (everything except salary) with a
// household you just created or joined. Only fills in categories the
// household's budgets don't already have, so it never overwrites existing
// shared budget amounts.
async function migratePersonalDataToHousehold(householdId) {
  const user = getCurrentUser();
  if (!supabase || !user) return;

  const simpleTables = [
    "kwenta_transactions",
    "kwenta_recurring",
    "kwenta_bills",
    "kwenta_goals",
    "kwenta_loans",
  ];
  await Promise.all(
    simpleTables.map((table) =>
      supabase
        .from(table)
        .update({ household_id: householdId })
        .eq("user_id", user.id)
        .is("household_id", null),
    ),
  );

  const { data: householdBudgets } = await supabase
    .from("kwenta_budgets")
    .select("category")
    .eq("household_id", householdId);
  const takenCategories = new Set(
    (householdBudgets || []).map((r) => r.category),
  );

  const { data: personalBudgets } = await supabase
    .from("kwenta_budgets")
    .select("category")
    .eq("user_id", user.id)
    .is("household_id", null);

  await Promise.all(
    (personalBudgets || [])
      .filter((r) => !takenCategories.has(r.category))
      .map((r) =>
        supabase
          .from("kwenta_budgets")
          .update({ household_id: householdId })
          .eq("user_id", user.id)
          .eq("category", r.category)
          .is("household_id", null),
      ),
  );
}
