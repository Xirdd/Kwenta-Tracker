-- Wallets: GCash, GoTyme, Maribank, plus generic Cash / Bank account / Other.
-- A wallet is just a labelled starting balance; transactions opt in to one
-- via the new kwenta_transactions.wallet_id column (nullable — existing
-- rows, and anything you don't bother tagging, are simply "unassigned").
--
-- No foreign key on wallet_id: kwenta_transactions already has bill_id,
-- goal_id, loan_id and recurring_id as plain, unconstrained text columns —
-- this follows the same convention. Deleting a wallet does NOT delete its
-- transactions (see src/wallets.js); they're just un-tagged.

create table if not exists public.kwenta_wallets (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.kwenta_households(id) on delete cascade,
  name text not null,
  provider text not null default 'other',
  starting_balance numeric not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.kwenta_wallets enable row level security;
create index if not exists kwenta_wallets_household_idx
  on public.kwenta_wallets (household_id);

alter table public.kwenta_wallets drop constraint if exists kwenta_wallets_provider_check;
alter table public.kwenta_wallets add constraint kwenta_wallets_provider_check
  check (provider in ('gcash','gotyme','maribank','bank','cash','other')) not valid;
alter table public.kwenta_wallets validate constraint kwenta_wallets_provider_check;

alter table public.kwenta_wallets drop constraint if exists kwenta_wallets_name_len;
alter table public.kwenta_wallets add constraint kwenta_wallets_name_len
  check (char_length(name) between 1 and 60) not valid;
alter table public.kwenta_wallets validate constraint kwenta_wallets_name_len;

drop policy if exists "Owner or household access to wallets" on public.kwenta_wallets;
create policy "Owner or household access to wallets"
  on public.kwenta_wallets
  as permissive for all to public
  using (((auth.uid() = user_id) or public.is_household_member(household_id))
         and public.session_satisfies_mfa())
  with check (public.session_satisfies_mfa() and (
    ((household_id is null) and (auth.uid() = user_id))
    or ((household_id is not null) and public.is_household_member(household_id))
  ));

drop policy if exists "kwenta_require_mfa" on public.kwenta_wallets;
create policy "kwenta_require_mfa"
  on public.kwenta_wallets
  as restrictive for all to authenticated
  using ((select public.kwenta_mfa_ok()))
  with check ((select public.kwenta_mfa_ok()));

grant select, insert, update, delete on public.kwenta_wallets to authenticated;
revoke all on public.kwenta_wallets from anon;

alter table public.kwenta_transactions add column if not exists wallet_id text;

-- Household activity log (the single trigger function added by
-- 20261012000000_security_and_alert_fixes.sql) now also recognizes wallets.
create or replace function public._kwenta_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_hid uuid;
  v_actor uuid;
  v_details jsonb;
begin
  v_row := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  v_hid := nullif(v_row->>'household_id', '')::uuid;
  if v_hid is null then
    return null;
  end if;

  v_actor := coalesce(auth.uid(), nullif(v_row->>'user_id', '')::uuid);

  v_details := case TG_TABLE_NAME
    when 'kwenta_transactions' then jsonb_build_object(
      'type', v_row->'type', 'desc', v_row->'description',
      'amount', v_row->'amount', 'category', v_row->'category')
    when 'kwenta_recurring' then jsonb_build_object(
      'type', v_row->'type', 'desc', v_row->'description',
      'amount', v_row->'amount', 'category', v_row->'category')
    when 'kwenta_budgets' then jsonb_build_object(
      'category', v_row->'category', 'amount', v_row->'amount')
    when 'kwenta_bills' then jsonb_build_object(
      'name', v_row->'name', 'dueDay', v_row->'due_day',
      'estimatedAmount', v_row->'estimated_amount')
    when 'kwenta_goals' then jsonb_build_object(
      'name', v_row->'name', 'targetAmount', v_row->'target_amount')
    when 'kwenta_loans' then jsonb_build_object(
      'person', v_row->'person', 'amount', v_row->'amount',
      'direction', v_row->'direction')
    when 'kwenta_wallets' then jsonb_build_object(
      'name', v_row->'name', 'provider', v_row->'provider')
    else '{}'::jsonb
  end;

  insert into kwenta_household_activity
    (household_id, user_id, user_email, table_name, action, details)
  values
    (v_hid, v_actor, _kwenta_current_user_email(v_actor),
     TG_TABLE_NAME, lower(TG_OP), v_details);
  return null;
end;
$$;

drop trigger if exists kwenta_wallets_activity_log on public.kwenta_wallets;
create trigger kwenta_wallets_activity_log
  after insert or update or delete on public.kwenta_wallets
  for each row execute function public._kwenta_log_activity();

-- Backup/restore and account deletion now cover wallets too.
create or replace function public.restore_my_data(payload jsonb, p_household_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if to_regprocedure('kwenta_mfa_ok()') is not null then
    if not kwenta_mfa_ok() then
      raise exception 'Two-factor verification required';
    end if;
  end if;
  if p_household_id is not null and not is_household_member(p_household_id) then
    raise exception 'Not a member of that household';
  end if;

  delete from kwenta_transactions       where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_recurring          where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_bills              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_goals              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_loans              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_wallets            where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_budgets            where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_custom_categories  where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_salary             where user_id = v_uid;

  insert into kwenta_salary (user_id, month_key, amount)
  select v_uid, month_key, amount
  from jsonb_populate_recordset(null::kwenta_salary, coalesce(payload->'salary', '[]'::jsonb));

  insert into kwenta_custom_categories (id, user_id, household_id, label, color, icon, active)
  select id, v_uid, p_household_id, label, color, icon, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_custom_categories, coalesce(payload->'custom_categories', '[]'::jsonb));

  insert into kwenta_budgets (user_id, household_id, category, amount, amount_second)
  select v_uid, p_household_id, category, coalesce(amount, 0), amount_second
  from jsonb_populate_recordset(null::kwenta_budgets, coalesce(payload->'budgets', '[]'::jsonb));

  insert into kwenta_wallets (id, user_id, household_id, name, provider, starting_balance, active)
  select id, v_uid, p_household_id, name, coalesce(provider, 'other'), coalesce(starting_balance, 0), coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_wallets, coalesce(payload->'wallets', '[]'::jsonb));

  insert into kwenta_recurring (id, user_id, household_id, type, description, amount, category, day_of_month, start_month, active)
  select id, v_uid, p_household_id, type, description, amount, category, day_of_month, start_month, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_recurring, coalesce(payload->'recurring', '[]'::jsonb));

  insert into kwenta_bills (id, user_id, household_id, name, category, custom_category, due_day, estimated_amount, active)
  select id, v_uid, p_household_id, name, category, custom_category, due_day, estimated_amount, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_bills, coalesce(payload->'bills', '[]'::jsonb));

  insert into kwenta_goals (id, user_id, household_id, name, target_amount, target_month, active)
  select id, v_uid, p_household_id, name, target_amount, target_month, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_goals, coalesce(payload->'goals', '[]'::jsonb));

  insert into kwenta_loans (id, user_id, household_id, person, direction, amount, date, note, active)
  select id, v_uid, p_household_id, person, direction, amount, date, note, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_loans, coalesce(payload->'loans', '[]'::jsonb));

  insert into kwenta_transactions (id, user_id, household_id, type, description, amount, category, date,
                                   recurring_id, bill_id, goal_id, loan_id, loan_kind, tags, wallet_id)
  select id, v_uid, p_household_id, type, coalesce(description, ''), amount, category, date,
         recurring_id, bill_id, goal_id, loan_id, loan_kind, tags, wallet_id
  from jsonb_populate_recordset(null::kwenta_transactions, coalesce(payload->'transactions', '[]'::jsonb));
end;
$$;

create or replace function public.delete_my_account_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not session_satisfies_mfa() then
    raise exception 'This account requires a completed 2FA session to delete account data.';
  end if;

  delete from kwenta_salary where user_id = auth.uid();
  delete from kwenta_transactions where user_id = auth.uid();
  delete from kwenta_recurring where user_id = auth.uid();
  delete from kwenta_budgets where user_id = auth.uid();
  delete from kwenta_bills where user_id = auth.uid();
  delete from kwenta_goals where user_id = auth.uid();
  delete from kwenta_loans where user_id = auth.uid();
  delete from kwenta_wallets where user_id = auth.uid();
  delete from kwenta_household_members where user_id = auth.uid();
end;
$$;