const PERIOD_MODE_KEY = "kwenta_period_mode";

// Per-device, same pattern as theme.js/currency.js — not synced to Supabase.
// "How I want to view my budget" is arguably worth syncing across devices,
// but keeping it local-only means this ships with zero new SQL and nothing
// that can conflict with another device; worth revisiting if that's wanted
// later.
export const PERIOD_MODES = [
  { id: "monthly", label: "Monthly", sub: "One budget for the whole month" },
  {
    id: "semi-monthly",
    label: "Semi-monthly",
    sub: "Separate limits for 1st–15th and 16th–end",
  },
];
const MODE_IDS = PERIOD_MODES.map((m) => m.id);
const DEFAULT_MODE = "semi-monthly"; // Kwenta's original behavior — existing users see no change

export function getPeriodMode() {
  try {
    const stored = localStorage.getItem(PERIOD_MODE_KEY);
    return MODE_IDS.includes(stored) ? stored : DEFAULT_MODE;
  } catch (e) {
    return DEFAULT_MODE;
  }
}

export function isSemiMonthly() {
  return getPeriodMode() === "semi-monthly";
}

export function setPeriodMode(mode) {
  if (!MODE_IDS.includes(mode)) return;
  try {
    localStorage.setItem(PERIOD_MODE_KEY, mode);
  } catch (e) {
    /* ignore */
  }
}
