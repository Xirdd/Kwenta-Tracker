import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";
import { getActiveHouseholdId } from "./household.js";
import { registerRetryable, enqueueRetry } from "./syncQueue.js";

// Cloud side of custom expense categories (kwenta_custom_categories, see
// supabase/custom_categories.sql and supabase/custom_categories_icon.sql).
// Kept in its own file, same pattern as budgetLimitsCloud.js, so sync.js
// doesn't need touching.

function scoped(query, householdId, userId) {
  return householdId
    ? query.eq("household_id", householdId)
    : query.eq("user_id", userId).is("household_id", null);
}

export async function cloudLoadCustomCategories() {
  const user = getCurrentUser();
  if (!supabase || !user) return [];
  const householdId = getActiveHouseholdId();

  const { data, error } = await scoped(
    supabase.from("kwenta_custom_categories").select("*"),
    householdId,
    user.id,
  );
  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    label: r.label,
    color: r.color,
    icon: r.icon || undefined, // missing -> categoryIcons.js falls back to the tag icon
    active: r.active,
  }));
}

async function upsert(cat) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  const row = {
    id: cat.id,
    user_id: user.id,
    household_id: getActiveHouseholdId(),
    label: cat.label,
    color: cat.color,
    icon: cat.icon || null,
    active: cat.active !== false,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase.from("kwenta_custom_categories").upsert(row);

  // If the icon column hasn't been added yet (the SQL migration wasn't run),
  // retry without it so the category itself still syncs. The icon then only
  // lives on this device until the migration is applied.
  if (error && /icon/i.test(error.message || "")) {
    const { icon, ...withoutIcon } = row;
    ({ error } = await supabase
      .from("kwenta_custom_categories")
      .upsert(withoutIcon));
  }
  if (error) throw error;
}

async function remove(id) {
  const user = getCurrentUser();
  if (!supabase || !user) return;
  const { error } = await supabase
    .from("kwenta_custom_categories")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) throw error;
}

// Replayed by syncQueue.js if a write fails offline.
registerRetryable("customCategoryUpsert", (args) => upsert(args[0]));
registerRetryable("customCategoryDelete", (args) => remove(args[0]));

export async function cloudUpsertCustomCategory(cat) {
  try {
    await upsert(cat);
  } catch (e) {
    enqueueRetry("customCategoryUpsert", [cat]);
    throw e;
  }
}

export async function cloudDeleteCustomCategory(id) {
  try {
    await remove(id);
  } catch (e) {
    enqueueRetry("customCategoryDelete", [id]);
    throw e;
  }
}
