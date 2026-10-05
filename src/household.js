import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";

let activeHousehold = null; // { id, name, inviteCode, inviteExpiresAt, createdBy } | null
const listeners = [];

export function getActiveHousehold() {
  return activeHousehold;
}

export function getActiveHouseholdId() {
  return activeHousehold ? activeHousehold.id : null;
}

// Only the creator can regenerate the invite code or remove members.
export function isHouseholdOwner() {
  const user = getCurrentUser();
  return !!(user && activeHousehold && activeHousehold.createdBy === user.id);
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

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    inviteExpiresAt: row.invite_expires_at || null,
    createdBy: row.created_by || null,
  };
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
    .select(
      "household_id, kwenta_households(id, name, invite_code, invite_expires_at, created_by)",
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.kwenta_households) {
    setActiveHousehold(null);
    return null;
  }
  const h = fromRow(data.kwenta_households);
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
  const user = getCurrentUser();
  const h = fromRow({ ...row, created_by: user ? user.id : null });
  setActiveHousehold(h);
  if (migrate) await migratePersonalDataToHousehold(h.id);
  return h;
}

// The server answers with a status string (not an exception) so failed
// attempts are counted for rate limiting. Wrong and expired codes are
// deliberately reported the same way.
const JOIN_MESSAGES = {
  invalid: "That code is invalid or has expired. Ask for a fresh one.",
  rate_limited: "Too many attempts. Wait about 15 minutes and try again.",
  in_household: "You're already in a household. Leave it first.",
};

export async function joinHousehold(code, { migrate = true } = {}) {
  requireSupabase();
  const { data, error } = await supabase.rpc("join_household_by_code", {
    code,
  });
  if (error) throw error;
  if (data !== "ok") {
    throw new Error(JOIN_MESSAGES[data] || "Couldn't join that household.");
  }
  const h = await loadActiveHousehold();
  if (migrate && h) await migratePersonalDataToHousehold(h.id);
  return h;
}

// Owner only (enforced in SQL). Replaces the code and restarts its 7 days.
export async function regenerateInviteCode() {
  requireSupabase();
  const h = activeHousehold;
  if (!h) throw new Error("You're not in a household.");
  const { data, error } = await supabase.rpc("regenerate_invite_code", {
    p_household_id: h.id,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  setActiveHousehold({
    ...h,
    inviteCode: row.invite_code,
    inviteExpiresAt: row.invite_expires_at,
  });
  return activeHousehold;
}

// [{ user_id, email, is_owner }] — any member can see the list.
export async function listHouseholdMembers() {
  requireSupabase();
  const h = activeHousehold;
  if (!h) return [];
  const { data, error } = await supabase.rpc("list_household_members", {
    p_household_id: h.id,
  });
  if (error) throw error;
  return data || [];
}

// Owner only (enforced in SQL). Their shared entries stay with the household.
export async function removeHouseholdMember(userId) {
  requireSupabase();
  const h = activeHousehold;
  if (!h) throw new Error("You're not in a household.");
  const { error } = await supabase.rpc("remove_household_member", {
    p_household_id: h.id,
    p_user_id: userId,
  });
  if (error) throw error;
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
// shared budget amounts. (Unchanged apart from checking each result: a failed
// update used to be silently ignored.)
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
  const results = await Promise.all(
    simpleTables.map((table) =>
      supabase
        .from(table)
        .update({ household_id: householdId })
        .eq("user_id", user.id)
        .is("household_id", null),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;

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
