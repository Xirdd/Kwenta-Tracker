import { supabase } from "./supabaseClient.js";

// Every table whose changes should show up live for the other household
// members. kwenta_custom_categories was missing, so a category someone added,
// renamed or deleted only appeared for the others after a manual refresh.
// Each table here must ALSO be in the supabase_realtime publication with
// replica identity full — see
// supabase/migrations/20261010000000_realtime_custom_categories.sql.
const SHARED_TABLES = [
  "kwenta_transactions",
  "kwenta_budgets",
  "kwenta_recurring",
  "kwenta_bills",
  "kwenta_goals",
  "kwenta_loans",
  "kwenta_custom_categories",
];

let channel = null;
let debounceTimer = null;
let currentHouseholdId = null;

// Subscribes to every shared table, filtered to one household. Multiple
// changes arriving close together (common when someone edits a recurring
// entry, which writes to two tables at once) are batched into a single
// reload instead of firing onChange repeatedly.
export function subscribeToHousehold(householdId, onChange) {
  if (!supabase || !householdId) {
    unsubscribeRealtime();
    return;
  }
  if (currentHouseholdId === householdId && channel) return; // already subscribed to this one

  unsubscribeRealtime();
  currentHouseholdId = householdId;
  channel = supabase.channel(`household-${householdId}`);

  SHARED_TABLES.forEach((table) => {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(onChange, 800);
      },
    );
  });

  channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error(
        "Realtime subscription issue for household",
        householdId,
        status,
      );
    }
  });
}

export function unsubscribeRealtime() {
  clearTimeout(debounceTimer);
  if (channel && supabase) {
    supabase.removeChannel(channel);
  }
  channel = null;
  currentHouseholdId = null;
}
