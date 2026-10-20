-- Wallets, round two:
--   1. Maya joins GCash / GoTyme / Maribank as a wallet provider.
--   2. A wallet can be private even for someone in a household. Private =
--      household_id null, which the existing row-level security already
--      supports (owner-only), so no policy changes are needed.
--   3. Recurring entries can carry a wallet (kwenta_recurring.wallet_id), so a
--      monthly GCash payment keeps landing on GCash.
--   4. restore_my_data understands all of the above.
--
-- Idempotent: safe to run twice.

alter table public.kwenta_wallets drop constraint if exists kwenta_wallets_provider_check;
alter table public.kwenta_wallets add constraint kwenta_wallets_provider_check
  check (provider in ('gcash','maya','gotyme','maribank','bank','cash','other')) not valid;
alter table public.kwenta_wallets validate constraint kwenta_wallets_provider_check;

alter table public.kwenta_recurring add column if not exists wallet_id text;

-- Backup/restore: wallets carry a "shared" flag, recurring carries wallet_id.
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
  -- Private wallets (household_id null) belong to the backup too, so inside a
  -- household both the household's wallets AND my private ones are replaced.
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

  -- "shared" is not a column (it is household_id being set or null), so the
  -- payload is read with an explicit column list. Backups made before this
  -- change have no flag and are treated as shared, which is what they were.
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