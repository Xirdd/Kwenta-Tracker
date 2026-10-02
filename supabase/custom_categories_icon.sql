-- ============================================================================
-- CUSTOM CATEGORY ICONS — adds the icon id a custom budget category displays.
--
-- Stores only the icon's string id (e.g. 'dumbbell', 'paw'), never SVG markup;
-- the id -> drawing mapping lives in src/icons/categoryIcons.js. NULL means
-- "no icon chosen" and renders as the default tag icon, so existing rows keep
-- working untouched.
--
-- SETUP: run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table kwenta_custom_categories
  add column if not exists icon text;