import { supabase } from "./supabaseClient.js";

// Reads recent activity for the given household — write access is
// intentionally not exposed here at all; every row is inserted by the
// database triggers in supabase/household_activity_log.sql, never by the
// client directly.
export async function fetchHouseholdActivity(householdId, limit = 50) {
  if (!supabase || !householdId) return [];
  const { data, error } = await supabase
    .from("kwenta_household_activity")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
