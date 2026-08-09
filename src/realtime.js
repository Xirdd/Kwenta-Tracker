import { supabase } from "./supabaseClient.js";

const SHARED_TABLES = [
  "kwenta_transactions",
  "kwenta_budgets",
  "kwenta_recurring",
  "kwenta_bills",
  "kwenta_goals",
  "kwenta_loans",
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
