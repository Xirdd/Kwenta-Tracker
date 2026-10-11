-- Security + correctness fixes found in the full-project review.
-- Idempotent: safe to re-run. Try it on a Supabase branch (or read it through
-- once) before `npm run db:push` — sections 6 and 7 change who may call what.
--
--  1. Household activity log: ONE trigger function (was six near-copies) that
--     credits the person who actually made the change.
--  2. Push helpers read their URL/secret from kwenta_app_settings (the
--     _kwenta_push_config() placeholders could never have worked).
--  3. Budget alerts: once per period (the trigger used to push on EVERY
--     expense after crossing the limit), per-half limits, household budgets.
--  4. Bill reminders: month-end safe, correct "1st/2nd/3rd/21st" wording,
--     and the duplicate cron entry point now delegates instead of re-sending.
--  5. 2FA recovery codes: cryptographically random + rate-limited guessing.
--  6. SECURITY DEFINER functions get a pinned search_path.
--  7. Internal helpers are no longer callable from the public API — notably
--     notify_user_push(), which let ANY signed-in user push arbitrary
--     notifications to ANY other user, and _kwenta_current_user_email(),
--     which looked up an email address from a user id.
--  8. Push subscriptions: an UPDATE policy (re-subscribing a device hit RLS).

-- ══ 1. Household activity log ═════════════════════════════════════════════
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
    return null; -- personal (unshared) row — nothing to log
  end if;

  -- Whoever is signed in made the change. The old per-table functions used the
  -- row's user_id, which is the ORIGINAL CREATOR — so when a household member
  -- edited or deleted someone else's entry, the log blamed the creator.
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

do $$
declare t text;
begin
  foreach t in array array[
    'kwenta_transactions', 'kwenta_budgets', 'kwenta_bills',
    'kwenta_goals', 'kwenta_loans', 'kwenta_recurring'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_activity_log', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public._kwenta_log_activity()',
      t || '_activity_log', t);
  end loop;
end $$;

drop function if exists public._kwenta_log_transaction_activity();
drop function if exists public._kwenta_log_budget_activity();
drop function if exists public._kwenta_log_bill_activity();
drop function if exists public._kwenta_log_goal_activity();
drop function if exists public._kwenta_log_loan_activity();
drop function if exists public._kwenta_log_recurring_activity();

-- ══ 2. Push helpers ═══════════════════════════════════════════════════════
-- Needs rows 'push_function_url' (the full send-push URL) and
-- 'push_function_secret' (same value as the PUSH_FUNCTION_SECRET function
-- secret) in kwenta_app_settings. Missing => quietly does nothing.
create or replace function public._kwenta_send_push(
  p_endpoint text, p_p256dh text, p_auth text,
  p_title text, p_body text, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from kwenta_app_settings where key = 'push_function_url';
  select value into v_secret from kwenta_app_settings where key = 'push_function_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object(
      'subscription', jsonb_build_object(
        'endpoint', p_endpoint,
        'keys', jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth)),
      'title', p_title, 'body', p_body, 'url', p_url)
  );
end;
$$;

-- Held placeholder values ('YOUR-PROJECT-REF') and was never usable.
drop function if exists public._kwenta_push_config();

-- ══ 3. Budget alerts ══════════════════════════════════════════════════════
-- Compares spending in the 1st–15th or 16th–end half against that half's
-- limit (amount / amount_second, falling back to amount). Household budgets
-- are looked up by household. Sends at most once per half-month per category.
--
-- Known limit: the database can't see the per-device "Monthly" budget-period
-- setting. In Monthly mode (one limit, stored in `amount`) this still measures
-- each half against it, so it can only alert LATE, never falsely.
create or replace function public.check_budget_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d date := new.date::date;
  v_half int := case when extract(day from new.date::date) <= 15 then 1 else 2 end;
  v_start date;
  v_end date;
  v_hid uuid := new.household_id;
  v_first numeric;
  v_second numeric;
  v_limit numeric;
  v_spent numeric;
  v_key text;
begin
  if new.type <> 'expense' or new.goal_id is not null or new.loan_id is not null then
    return new; -- only real expenses count, matching the app's own rule
  end if;

  v_start := case when v_half = 1 then date_trunc('month', v_d)::date
                  else date_trunc('month', v_d)::date + 15 end;
  v_end := case when v_half = 1 then date_trunc('month', v_d)::date + 14
                else (date_trunc('month', v_d) + interval '1 month')::date - 1 end;
  v_key := to_char(v_d, 'YYYY-MM') || '-' || v_half;

  select amount, amount_second into v_first, v_second
  from kwenta_budgets
  where category = new.category
    and ((v_hid is not null and household_id = v_hid)
      or (v_hid is null and user_id = new.user_id and household_id is null))
  limit 1;
  if not found then
    return new;
  end if;

  v_limit := case when v_half = 1 then v_first else coalesce(v_second, v_first) end;
  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  select coalesce(sum(amount), 0) into v_spent
  from kwenta_transactions
  where category = new.category
    and type = 'expense'
    and goal_id is null and loan_id is null
    and date between v_start and v_end
    and ((v_hid is not null and household_id = v_hid)
      or (v_hid is null and user_id = new.user_id and household_id is null));

  if v_spent <= v_limit then
    return new;
  end if;

  insert into kwenta_budget_alert_log (user_id, category, month_key)
  values (new.user_id, new.category, v_key)
  on conflict do nothing;
  if not found then
    return new; -- already alerted for this half-month
  end if;

  perform notify_user_push(
    new.user_id,
    'Budget alert',
    'You''ve spent ' || to_char(v_spent, 'FM999,999,990.00') || ' on ' || new.category ||
      ' this period — ' || to_char(v_spent - v_limit, 'FM999,999,990.00') || ' over your limit.',
    '/'
  );
  return new;
exception when others then
  raise warning 'check_budget_alert failed (non-fatal): %', sqlerrm;
  return new;
end;
$$;

-- The trigger above now does this job. This cron entry point used to send a
-- second, month-based, un-deduplicated alert through the broken push config.
create or replace function public.kwenta_send_budget_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return; -- superseded by check_budget_alert() (trigger budget_alert_trigger)
end;
$$;

-- ══ 4. Bill reminders ═════════════════════════════════════════════════════
create or replace function public.check_upcoming_bills()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  v_month text := to_char(current_date, 'YYYY-MM');
  v_due date;
  v_suffix text;
begin
  for b in
    select id, user_id, name, custom_category, due_day
    from kwenta_bills
    where active is not false
  loop
    -- Compare real dates: the old "due_day between today and today + 3"
    -- never matched across a month end (28th -> 1st).
    v_due := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      least(b.due_day, 28));
    if v_due - current_date not between 0 and 3 then
      continue;
    end if;

    if exists (
      select 1 from kwenta_transactions
      where bill_id = b.id and to_char(date::date, 'YYYY-MM') = v_month
    ) then
      continue; -- already paid this month
    end if;

    insert into kwenta_bill_reminders_sent (user_id, bill_id, month_key)
    values (b.user_id, b.id, v_month)
    on conflict do nothing;
    if not found then
      continue; -- already reminded this month
    end if;

    v_suffix := case
      when b.due_day % 10 = 1 and b.due_day % 100 <> 11 then 'st'
      when b.due_day % 10 = 2 and b.due_day % 100 <> 12 then 'nd'
      when b.due_day % 10 = 3 and b.due_day % 100 <> 13 then 'rd'
      else 'th' end;

    perform notify_user_push(
      b.user_id,
      'Bill due soon',
      coalesce(b.name, b.custom_category, 'A bill') || ' is due on the ' || b.due_day || v_suffix || '.',
      '/');
  end loop;
exception when others then
  raise warning 'check_upcoming_bills failed (non-fatal): %', sqlerrm;
end;
$$;

-- Second cron entry point for the same job, with no "already sent" memory (it
-- would re-send every run). Whichever of the two your pg_cron job calls, the
-- deduplicated version above now does the work.
create or replace function public.kwenta_send_bill_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_upcoming_bills();
end;
$$;

-- ══ 5. 2FA recovery codes ═════════════════════════════════════════════════
create table if not exists public.kwenta_recovery_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists kwenta_recovery_attempts_user_idx
  on public.kwenta_recovery_attempts (user_id, attempted_at desc);
alter table public.kwenta_recovery_attempts enable row level security;
revoke all on public.kwenta_recovery_attempts from anon, authenticated;

-- Codes were 8 hex characters from md5(random()) — random() isn't a secure
-- generator. Now 10 hex characters (40 bits) from pgcrypto, "XXXXX-XXXXX".
-- Existing codes keep working until regenerated.
create or replace function public.generate_mfa_recovery_codes()
returns text[]
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  codes text[] := array[]::text[];
  c text;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from kwenta_mfa_recovery_codes where user_id = auth.uid();

  for i in 1..8 loop
    c := upper(encode(extensions.gen_random_bytes(5), 'hex'));
    c := substr(c, 1, 5) || '-' || substr(c, 6, 5);
    codes := array_append(codes, c);
    insert into kwenta_mfa_recovery_codes (user_id, code_hash)
    values (auth.uid(), extensions.crypt(c, extensions.gen_salt('bf')));
  end loop;

  return codes;
end;
$$;

-- This function is callable from a password-only (aal1) session BY DESIGN, and
-- a correct code removes the second factor — so it must not be guessable
-- without limit. 5 wrong tries per 15 minutes, like verify_my_password().
create or replace function public.verify_mfa_recovery_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_match uuid;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select count(*) into v_recent
  from kwenta_recovery_attempts
  where user_id = v_uid and attempted_at > now() - interval '15 minutes';
  if v_recent >= 5 then
    raise exception 'Too many attempts. Wait about 15 minutes and try again.';
  end if;

  select id into v_match
  from kwenta_mfa_recovery_codes
  where user_id = v_uid
    and used_at is null
    and code_hash = extensions.crypt(coalesce(input_code, ''), code_hash)
  limit 1;

  if v_match is null then
    insert into kwenta_recovery_attempts (user_id) values (v_uid);
    delete from kwenta_recovery_attempts where attempted_at < now() - interval '1 day';
    return false;
  end if;

  update kwenta_mfa_recovery_codes set used_at = now() where id = v_match;
  delete from auth.mfa_factors where user_id = v_uid;
  delete from kwenta_recovery_attempts where user_id = v_uid;
  return true;
end;
$$;

-- ══ 6. Pin search_path on the remaining SECURITY DEFINER functions ════════
alter function public._kwenta_current_user_email(uuid) set search_path = public;
alter function public.count_remaining_mfa_recovery_codes() set search_path = public;
alter function public.delete_my_account_data() set search_path = public;
alter function public.has_verified_mfa() set search_path = public;
alter function public.is_household_member(uuid) set search_path = public;
alter function public.kwenta_prune_household_activity() set search_path = public;
alter function public.list_my_sessions() set search_path = public;
alter function public.notify_user_push(uuid, text, text, text) set search_path = public;
alter function public.session_satisfies_mfa() set search_path = public;

-- ══ 7. Function privileges ════════════════════════════════════════════════
-- Postgres grants EXECUTE to everyone by default, and Supabase exposes every
-- function in `public` as an API endpoint. Internal helpers are locked away;
-- the functions the app calls are limited to signed-in users.
do $$
declare sig text;
begin
  -- Internal only: triggers, cron jobs, and other functions call these.
  foreach sig in array array[
    'public.notify_user_push(uuid, text, text, text)',
    'public._kwenta_send_push(text, text, text, text, text, text)',
    'public._kwenta_current_user_email(uuid)',
    'public._kwenta_log_activity()',
    'public.check_budget_alert()',
    'public.check_upcoming_bills()',
    'public.kwenta_send_bill_reminders()',
    'public.kwenta_send_budget_alerts()',
    'public.kwenta_prune_household_activity()',
    'public.kwenta_new_invite_code()',
    'public.generate_invite_code()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', sig);
  end loop;

  -- Called by the app: signed-in users only.
  foreach sig in array array[
    'public.create_household(text)',
    'public.join_household_by_code(text)',
    'public.regenerate_invite_code(uuid)',
    'public.list_household_members(uuid)',
    'public.remove_household_member(uuid, uuid)',
    'public.restore_my_data(jsonb, uuid)',
    'public.delete_my_account_data()',
    'public.verify_my_password(text)',
    'public.list_my_sessions()',
    'public.generate_mfa_recovery_codes()',
    'public.verify_mfa_recovery_code(text)',
    'public.count_remaining_mfa_recovery_codes()'
  ] loop
    execute format('revoke execute on function %s from public, anon', sig);
    execute format('grant execute on function %s to authenticated, service_role', sig);
  end loop;
end $$;

-- ══ 8. Push subscriptions ═════════════════════════════════════════════════
-- enablePush() upserts on `endpoint`; when the row already exists that is an
-- UPDATE, which had no policy and failed with an RLS error.
drop policy if exists "update own push subs" on public.kwenta_push_subscriptions;
create policy "update own push subs"
  on public.kwenta_push_subscriptions
  for update
  to public
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);