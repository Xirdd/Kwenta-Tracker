-- ============================================================================
-- HOUSEHOLD ACTIVITY LOG — "who added/changed/removed what" for shared data.
--
-- Design choice, stated plainly: this logs a moderate level of detail — what
-- table, what action (insert/update/delete), and the KEY fields relevant to
-- that table (amount, category, name, etc.) — not a full old-value-vs-new-
-- value diff on every column. A true field-level diff needs to capture and
-- compare OLD vs NEW per column per table, which is a meaningfully bigger
-- and more fragile piece of trigger logic for benefit that's mostly only
-- useful for budgets/amount-style edits anyway. If you want that later, the
-- `details` jsonb column here already carries enough that it can be
-- extended without a schema change — just add more keys per table's trigger
-- function below.
--
-- Also a deliberate choice: `details` is structured JSON (category id,
-- amount, name, etc.), not a pre-formatted sentence. Formatting a readable
-- summary happens client-side (householdActivity.js), reusing the app's own
-- existing category labels/icons (catInfo/incCatInfo) rather than
-- duplicating that mapping in SQL.
--
-- SETUP: run this whole file in the Supabase SQL Editor. Requires
-- `is_household_member(household_id uuid)` to already exist (per your
-- schema.sql, referenced in your README as the helper used by every other
-- shared table's RLS policy) — if your actual helper has a different name
-- or signature, adjust the policy near the bottom of this file to match.
-- ============================================================================

create table if not exists kwenta_household_activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references kwenta_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  -- Denormalized snapshot of the email at the time of the action — other
  -- household members don't have SELECT access to auth.users, so this is
  -- the only way they can see WHO did something without a service-role call.
  user_email text not null,
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists kwenta_household_activity_household_idx
  on kwenta_household_activity (household_id, created_at desc);

alter table kwenta_household_activity enable row level security;

-- Read-only for household members. No insert/update/delete policy is
-- defined for regular users on purpose — the only writes come from the
-- trigger functions below, which run as security definer.
drop policy if exists "household members can view activity" on kwenta_household_activity;
create policy "household members can view activity"
  on kwenta_household_activity for select
  using (is_household_member(household_id));

-- Shared helper: looks up the acting user's email once, so each per-table
-- trigger function doesn't repeat the same subquery.
create or replace function _kwenta_current_user_email(p_user_id uuid)
returns text as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_user_id;
  return coalesce(v_email, 'Unknown');
end;
$$ language plpgsql security definer;

-- ── kwenta_transactions ──────────────────────────────────────────────────
create or replace function _kwenta_log_transaction_activity()
returns trigger as $$
declare
  v_row record;
  v_action text;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  v_action := lower(TG_OP);

  if v_row.household_id is null then
    return v_row; -- personal (unshared) row — nothing to log
  end if;

  insert into kwenta_household_activity (household_id, user_id, user_email, table_name, action, details)
  values (
    v_row.household_id,
    v_row.user_id,
    _kwenta_current_user_email(v_row.user_id),
    'kwenta_transactions',
    v_action,
    jsonb_build_object(
      'type', v_row.type,
      'desc', v_row.description,
      'amount', v_row.amount,
      'category', v_row.category
    )
  );
  return v_row;
end;
$$ language plpgsql security definer;

drop trigger if exists kwenta_transactions_activity_log on kwenta_transactions;
create trigger kwenta_transactions_activity_log
  after insert or update or delete on kwenta_transactions
  for each row execute function _kwenta_log_transaction_activity();

-- ── kwenta_budgets ───────────────────────────────────────────────────────
create or replace function _kwenta_log_budget_activity()
returns trigger as $$
declare
  v_row record;
  v_action text;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  v_action := lower(TG_OP);

  if v_row.household_id is null then
    return v_row;
  end if;

  insert into kwenta_household_activity (household_id, user_id, user_email, table_name, action, details)
  values (
    v_row.household_id,
    v_row.user_id,
    _kwenta_current_user_email(v_row.user_id),
    'kwenta_budgets',
    v_action,
    jsonb_build_object('category', v_row.category, 'amount', v_row.amount)
  );
  return v_row;
end;
$$ language plpgsql security definer;

drop trigger if exists kwenta_budgets_activity_log on kwenta_budgets;
create trigger kwenta_budgets_activity_log
  after insert or update or delete on kwenta_budgets
  for each row execute function _kwenta_log_budget_activity();

-- ── kwenta_bills ─────────────────────────────────────────────────────────
create or replace function _kwenta_log_bill_activity()
returns trigger as $$
declare
  v_row record;
  v_action text;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  v_action := lower(TG_OP);

  if v_row.household_id is null then
    return v_row;
  end if;

  insert into kwenta_household_activity (household_id, user_id, user_email, table_name, action, details)
  values (
    v_row.household_id,
    v_row.user_id,
    _kwenta_current_user_email(v_row.user_id),
    'kwenta_bills',
    v_action,
    jsonb_build_object('name', v_row.name, 'dueDay', v_row.due_day, 'estimatedAmount', v_row.estimated_amount)
  );
  return v_row;
end;
$$ language plpgsql security definer;

drop trigger if exists kwenta_bills_activity_log on kwenta_bills;
create trigger kwenta_bills_activity_log
  after insert or update or delete on kwenta_bills
  for each row execute function _kwenta_log_bill_activity();

-- ── kwenta_goals ─────────────────────────────────────────────────────────
create or replace function _kwenta_log_goal_activity()
returns trigger as $$
declare
  v_row record;
  v_action text;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  v_action := lower(TG_OP);

  if v_row.household_id is null then
    return v_row;
  end if;

  insert into kwenta_household_activity (household_id, user_id, user_email, table_name, action, details)
  values (
    v_row.household_id,
    v_row.user_id,
    _kwenta_current_user_email(v_row.user_id),
    'kwenta_goals',
    v_action,
    jsonb_build_object('name', v_row.name, 'targetAmount', v_row.target_amount)
  );
  return v_row;
end;
$$ language plpgsql security definer;

drop trigger if exists kwenta_goals_activity_log on kwenta_goals;
create trigger kwenta_goals_activity_log
  after insert or update or delete on kwenta_goals
  for each row execute function _kwenta_log_goal_activity();

-- ── kwenta_loans ─────────────────────────────────────────────────────────
create or replace function _kwenta_log_loan_activity()
returns trigger as $$
declare
  v_row record;
  v_action text;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  v_action := lower(TG_OP);

  if v_row.household_id is null then
    return v_row;
  end if;

  insert into kwenta_household_activity (household_id, user_id, user_email, table_name, action, details)
  values (
    v_row.household_id,
    v_row.user_id,
    _kwenta_current_user_email(v_row.user_id),
    'kwenta_loans',
    v_action,
    jsonb_build_object('person', v_row.person, 'amount', v_row.amount, 'direction', v_row.direction)
  );
  return v_row;
end;
$$ language plpgsql security definer;

drop trigger if exists kwenta_loans_activity_log on kwenta_loans;
create trigger kwenta_loans_activity_log
  after insert or update or delete on kwenta_loans
  for each row execute function _kwenta_log_loan_activity();

-- ── kwenta_recurring ─────────────────────────────────────────────────────
create or replace function _kwenta_log_recurring_activity()
returns trigger as $$
declare
  v_row record;
  v_action text;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  v_action := lower(TG_OP);

  if v_row.household_id is null then
    return v_row;
  end if;

  insert into kwenta_household_activity (household_id, user_id, user_email, table_name, action, details)
  values (
    v_row.household_id,
    v_row.user_id,
    _kwenta_current_user_email(v_row.user_id),
    'kwenta_recurring',
    v_action,
    jsonb_build_object('type', v_row.type, 'desc', v_row.description, 'amount', v_row.amount, 'category', v_row.category)
  );
  return v_row;
end;
$$ language plpgsql security definer;

drop trigger if exists kwenta_recurring_activity_log on kwenta_recurring;
create trigger kwenta_recurring_activity_log
  after insert or update or delete on kwenta_recurring
  for each row execute function _kwenta_log_recurring_activity();

-- ── Housekeeping: keep the log from growing forever ────────────────────
-- Optional but recommended. Requires pg_cron (same extension used by
-- push_notifications.sql, if you've set that up — enable separately if not:
--   create extension if not exists pg_cron;
create or replace function kwenta_prune_household_activity()
returns void as $$
begin
  delete from kwenta_household_activity where created_at < now() - interval '180 days';
end;
$$ language plpgsql security definer;

select cron.unschedule('kwenta-prune-activity-log') where exists (
  select 1 from cron.job where jobname = 'kwenta-prune-activity-log'
);
select cron.schedule(
  'kwenta-prune-activity-log',
  '0 3 * * 0', -- weekly, Sunday 3am UTC
  $$select kwenta_prune_household_activity();$$
);