-- Installments (SPayLater and similar multi-month payment plans).
--
-- A plan is a template: item name, total amount, monthly payment, total months,
-- remaining months and which day the monthly payment is due ('15th' or 'last'
-- day of the month, matching Shopee SPayLater cycles). Each month's payment is
-- a real expense (category 'installments') linked to the plan through the new
-- kwenta_transactions.installment_id column, exactly like bills use bill_id.
-- Paying decrements remaining_months; undoing a payment increments it.
--
-- Shared inside a household like bills/goals/utang (household_id), so it is
-- also added to realtime, the activity log, backup/restore and account
-- deletion below. Idempotent: safe to run twice.

create table if not exists public.kwenta_installments (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.kwenta_households(id) on delete cascade,
  name text not null,
  total_amount numeric not null default 0,
  monthly_amount numeric not null default 0,
  total_months smallint not null default 1,
  remaining_months smallint not null default 1,
  due_rule text not null default 'last',
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.kwenta_installments enable row level security;
create index if not exists kwenta_installments_household_idx
  on public.kwenta_installments (household_id);

alter table public.kwenta_installments drop constraint if exists kwenta_installments_checks;
alter table public.kwenta_installments add constraint kwenta_installments_checks check (
  char_length(name) between 1 and 80
  and total_amount >= 0
  and monthly_amount >= 0
  and total_months between 1 and 120
  and remaining_months between 0 and total_months
  and due_rule in ('15th', 'last')
) not valid;
alter table public.kwenta_installments validate constraint kwenta_installments_checks;

drop policy if exists "Owner or household access to installments" on public.kwenta_installments;
create policy "Owner or household access to installments"
  on public.kwenta_installments
  as permissive for all to public
  using (((auth.uid() = user_id) or public.is_household_member(household_id))
         and public.session_satisfies_mfa())
  with check (public.session_satisfies_mfa() and (
    ((household_id is null) and (auth.uid() = user_id))
    or ((household_id is not null) and public.is_household_member(household_id))
  ));

drop policy if exists "kwenta_require_mfa" on public.kwenta_installments;
create policy "kwenta_require_mfa"
  on public.kwenta_installments
  as restrictive for all to authenticated
  using ((select public.kwenta_mfa_ok()))
  with check ((select public.kwenta_mfa_ok()));

grant select, insert, update, delete on public.kwenta_installments to authenticated;
revoke all on public.kwenta_installments from anon;

alter table public.kwenta_transactions add column if not exists installment_id text;

-- Realtime: other household members see plan changes live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'kwenta_installments'
  ) then
    alter publication supabase_realtime add table public.kwenta_installments;
  end if;
end $$;
alter table public.kwenta_installments replica identity full;

-- Activity log: the single trigger function now also describes installments.
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
    when 'kwenta_installments' then jsonb_build_object(
      'name', v_row->'name', 'monthlyAmount', v_row->'monthly_amount',
      'totalMonths', v_row->'total_months')
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

drop trigger if exists kwenta_installments_activity_log on public.kwenta_installments;
create trigger kwenta_installments_activity_log
  after insert or update or delete on public.kwenta_installments
  for each row execute function public._kwenta_log_activity();

-- Backup/restore: installments carried along, and transactions keep their
-- wallet_id / installment_id (so a restore doesn't unlink payments).
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
  delete from kwenta_installments       where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_goals              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_loans              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_wallets            where user_id = v_uid and (household_id is not distinct from p_household_id or household_id is null);
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
  select w.id, v_uid,
         case when coalesce(w.shared, true) and p_household_id is not null then p_household_id else null end,
         w.name, coalesce(w.provider, 'other'), coalesce(w.starting_balance, 0), coalesce(w.active, true)
  from jsonb_to_recordset(coalesce(payload->'wallets', '[]'::jsonb))
    as w(id text, name text, provider text, starting_balance numeric, active boolean, shared boolean);

  insert into kwenta_recurring (id, user_id, household_id, type, description, amount, category, day_of_month, start_month, wallet_id, active)
  select id, v_uid, p_household_id, type, description, amount, category, day_of_month, start_month, wallet_id, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_recurring, coalesce(payload->'recurring', '[]'::jsonb));

  insert into kwenta_bills (id, user_id, household_id, name, category, custom_category, due_day, estimated_amount, active)
  select id, v_uid, p_household_id, name, category, custom_category, due_day, estimated_amount, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_bills, coalesce(payload->'bills', '[]'::jsonb));

  insert into kwenta_installments (id, user_id, household_id, name, total_amount, monthly_amount, total_months, remaining_months, due_rule, active)
  select id, v_uid, p_household_id, name, coalesce(total_amount, 0), coalesce(monthly_amount, 0),
         coalesce(total_months, 1), coalesce(remaining_months, coalesce(total_months, 1)),
         coalesce(due_rule, 'last'), coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_installments, coalesce(payload->'installments', '[]'::jsonb));

  insert into kwenta_goals (id, user_id, household_id, name, target_amount, target_month, active)
  select id, v_uid, p_household_id, name, target_amount, target_month, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_goals, coalesce(payload->'goals', '[]'::jsonb));

  insert into kwenta_loans (id, user_id, household_id, person, direction, amount, date, note, active)
  select id, v_uid, p_household_id, person, direction, amount, date, note, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_loans, coalesce(payload->'loans', '[]'::jsonb));

  insert into kwenta_transactions (id, user_id, household_id, type, description, amount, category, date,
                                   recurring_id, bill_id, goal_id, loan_id, loan_kind, tags, wallet_id, installment_id)
  select id, v_uid, p_household_id, type, coalesce(description, ''), amount, category, date,
         recurring_id, bill_id, goal_id, loan_id, loan_kind, tags, wallet_id, installment_id
  from jsonb_populate_recordset(null::kwenta_transactions, coalesce(payload->'transactions', '[]'::jsonb));
end;
$$;

-- Account deletion removes installments too.
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
  delete from kwenta_installments where user_id = auth.uid();
  delete from kwenta_goals where user_id = auth.uid();
  delete from kwenta_loans where user_id = auth.uid();
  delete from kwenta_wallets where user_id = auth.uid();
  delete from kwenta_household_members where user_id = auth.uid();
end;
$$;