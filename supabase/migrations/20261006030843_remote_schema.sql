create extension if not exists "pg_cron" with schema "pg_catalog";

create sequence "public"."kwenta_password_checks_id_seq";


  create table "public"."kwenta_app_settings" (
    "key" text not null,
    "value" text not null
      );


alter table "public"."kwenta_app_settings" enable row level security;


  create table "public"."kwenta_bill_reminders_sent" (
    "user_id" uuid not null,
    "bill_id" text not null,
    "month_key" text not null,
    "sent_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_bill_reminders_sent" enable row level security;


  create table "public"."kwenta_bills" (
    "id" text not null,
    "user_id" uuid not null,
    "name" text not null,
    "category" text not null,
    "due_day" smallint not null,
    "estimated_amount" numeric,
    "active" boolean not null default true,
    "updated_at" timestamp with time zone not null default now(),
    "custom_category" text,
    "household_id" uuid
      );


alter table "public"."kwenta_bills" enable row level security;


  create table "public"."kwenta_budget_alert_log" (
    "user_id" uuid not null,
    "category" text not null,
    "month_key" text not null,
    "sent_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_budget_alert_log" enable row level security;


  create table "public"."kwenta_budgets" (
    "user_id" uuid not null,
    "category" text not null,
    "amount" numeric not null,
    "updated_at" timestamp with time zone not null default now(),
    "household_id" uuid,
    "amount_second" numeric
      );


alter table "public"."kwenta_budgets" enable row level security;


  create table "public"."kwenta_custom_categories" (
    "id" text not null,
    "user_id" uuid not null,
    "household_id" uuid,
    "label" text not null,
    "color" text not null,
    "icon" text,
    "active" boolean not null default true,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_custom_categories" enable row level security;


  create table "public"."kwenta_goals" (
    "id" text not null,
    "user_id" uuid not null,
    "name" text not null,
    "target_amount" numeric not null,
    "target_month" text,
    "active" boolean not null default true,
    "updated_at" timestamp with time zone not null default now(),
    "household_id" uuid
      );


alter table "public"."kwenta_goals" enable row level security;


  create table "public"."kwenta_household_activity" (
    "id" uuid not null default gen_random_uuid(),
    "household_id" uuid not null,
    "user_id" uuid,
    "user_email" text not null,
    "table_name" text not null,
    "action" text not null,
    "details" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_household_activity" enable row level security;


  create table "public"."kwenta_household_members" (
    "household_id" uuid not null,
    "user_id" uuid not null,
    "joined_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_household_members" enable row level security;


  create table "public"."kwenta_households" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "invite_code" text not null,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "invite_expires_at" timestamp with time zone default (now() + '7 days'::interval)
      );


alter table "public"."kwenta_households" enable row level security;


  create table "public"."kwenta_join_attempts" (
    "user_id" uuid not null,
    "attempted_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_join_attempts" enable row level security;


  create table "public"."kwenta_loans" (
    "id" text not null,
    "user_id" uuid not null,
    "person" text not null,
    "direction" text not null,
    "amount" numeric not null,
    "date" date not null,
    "note" text,
    "active" boolean not null default true,
    "updated_at" timestamp with time zone not null default now(),
    "household_id" uuid
      );


alter table "public"."kwenta_loans" enable row level security;


  create table "public"."kwenta_mfa_recovery_codes" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "code_hash" text not null,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_mfa_recovery_codes" enable row level security;


  create table "public"."kwenta_password_checks" (
    "id" bigint not null default nextval('public.kwenta_password_checks_id_seq'::regclass),
    "user_id" uuid not null,
    "checked_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_password_checks" enable row level security;


  create table "public"."kwenta_push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "endpoint" text not null,
    "p256dh" text not null,
    "auth_key" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_push_subscriptions" enable row level security;


  create table "public"."kwenta_recurring" (
    "id" text not null,
    "user_id" uuid not null,
    "type" text not null,
    "description" text,
    "amount" numeric not null,
    "category" text not null,
    "day_of_month" smallint not null,
    "start_month" text not null,
    "active" boolean not null default true,
    "updated_at" timestamp with time zone not null default now(),
    "household_id" uuid
      );


alter table "public"."kwenta_recurring" enable row level security;


  create table "public"."kwenta_salary" (
    "user_id" uuid not null,
    "month_key" text not null,
    "amount" numeric not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwenta_salary" enable row level security;


  create table "public"."kwenta_transactions" (
    "id" text not null,
    "user_id" uuid not null,
    "type" text not null,
    "description" text,
    "amount" numeric not null,
    "category" text not null,
    "date" date not null,
    "updated_at" timestamp with time zone not null default now(),
    "recurring_id" text,
    "bill_id" text,
    "goal_id" text,
    "loan_id" text,
    "loan_kind" text,
    "household_id" uuid,
    "tags" text[]
      );


alter table "public"."kwenta_transactions" enable row level security;

alter sequence "public"."kwenta_password_checks_id_seq" owned by "public"."kwenta_password_checks"."id";

CREATE UNIQUE INDEX kwenta_app_settings_pkey ON public.kwenta_app_settings USING btree (key);

CREATE UNIQUE INDEX kwenta_bill_reminders_sent_pkey ON public.kwenta_bill_reminders_sent USING btree (user_id, bill_id, month_key);

CREATE UNIQUE INDEX kwenta_bills_pkey ON public.kwenta_bills USING btree (user_id, id);

CREATE UNIQUE INDEX kwenta_budget_alert_log_pkey ON public.kwenta_budget_alert_log USING btree (user_id, category, month_key);

CREATE UNIQUE INDEX kwenta_budgets_pkey ON public.kwenta_budgets USING btree (user_id, category);

CREATE INDEX kwenta_custom_categories_household_idx ON public.kwenta_custom_categories USING btree (household_id);

CREATE UNIQUE INDEX kwenta_custom_categories_pkey ON public.kwenta_custom_categories USING btree (id);

CREATE INDEX kwenta_custom_categories_user_idx ON public.kwenta_custom_categories USING btree (user_id);

CREATE UNIQUE INDEX kwenta_goals_pkey ON public.kwenta_goals USING btree (user_id, id);

CREATE INDEX kwenta_household_activity_household_idx ON public.kwenta_household_activity USING btree (household_id, created_at DESC);

CREATE UNIQUE INDEX kwenta_household_activity_pkey ON public.kwenta_household_activity USING btree (id);

CREATE UNIQUE INDEX kwenta_household_members_pkey ON public.kwenta_household_members USING btree (household_id, user_id);

CREATE UNIQUE INDEX kwenta_households_invite_code_key ON public.kwenta_households USING btree (invite_code);

CREATE UNIQUE INDEX kwenta_households_pkey ON public.kwenta_households USING btree (id);

CREATE INDEX kwenta_join_attempts_user_idx ON public.kwenta_join_attempts USING btree (user_id, attempted_at DESC);

CREATE UNIQUE INDEX kwenta_loans_pkey ON public.kwenta_loans USING btree (user_id, id);

CREATE UNIQUE INDEX kwenta_mfa_recovery_codes_pkey ON public.kwenta_mfa_recovery_codes USING btree (id);

CREATE UNIQUE INDEX kwenta_password_checks_pkey ON public.kwenta_password_checks USING btree (id);

CREATE INDEX kwenta_password_checks_user_idx ON public.kwenta_password_checks USING btree (user_id, checked_at DESC);

CREATE UNIQUE INDEX kwenta_push_subscriptions_endpoint_key ON public.kwenta_push_subscriptions USING btree (endpoint);

CREATE UNIQUE INDEX kwenta_push_subscriptions_pkey ON public.kwenta_push_subscriptions USING btree (id);

CREATE UNIQUE INDEX kwenta_recurring_pkey ON public.kwenta_recurring USING btree (user_id, id);

CREATE UNIQUE INDEX kwenta_salary_pkey ON public.kwenta_salary USING btree (user_id, month_key);

CREATE UNIQUE INDEX kwenta_transactions_pkey ON public.kwenta_transactions USING btree (user_id, id);

alter table "public"."kwenta_app_settings" add constraint "kwenta_app_settings_pkey" PRIMARY KEY using index "kwenta_app_settings_pkey";

alter table "public"."kwenta_bill_reminders_sent" add constraint "kwenta_bill_reminders_sent_pkey" PRIMARY KEY using index "kwenta_bill_reminders_sent_pkey";

alter table "public"."kwenta_bills" add constraint "kwenta_bills_pkey" PRIMARY KEY using index "kwenta_bills_pkey";

alter table "public"."kwenta_budget_alert_log" add constraint "kwenta_budget_alert_log_pkey" PRIMARY KEY using index "kwenta_budget_alert_log_pkey";

alter table "public"."kwenta_budgets" add constraint "kwenta_budgets_pkey" PRIMARY KEY using index "kwenta_budgets_pkey";

alter table "public"."kwenta_custom_categories" add constraint "kwenta_custom_categories_pkey" PRIMARY KEY using index "kwenta_custom_categories_pkey";

alter table "public"."kwenta_goals" add constraint "kwenta_goals_pkey" PRIMARY KEY using index "kwenta_goals_pkey";

alter table "public"."kwenta_household_activity" add constraint "kwenta_household_activity_pkey" PRIMARY KEY using index "kwenta_household_activity_pkey";

alter table "public"."kwenta_household_members" add constraint "kwenta_household_members_pkey" PRIMARY KEY using index "kwenta_household_members_pkey";

alter table "public"."kwenta_households" add constraint "kwenta_households_pkey" PRIMARY KEY using index "kwenta_households_pkey";

alter table "public"."kwenta_loans" add constraint "kwenta_loans_pkey" PRIMARY KEY using index "kwenta_loans_pkey";

alter table "public"."kwenta_mfa_recovery_codes" add constraint "kwenta_mfa_recovery_codes_pkey" PRIMARY KEY using index "kwenta_mfa_recovery_codes_pkey";

alter table "public"."kwenta_password_checks" add constraint "kwenta_password_checks_pkey" PRIMARY KEY using index "kwenta_password_checks_pkey";

alter table "public"."kwenta_push_subscriptions" add constraint "kwenta_push_subscriptions_pkey" PRIMARY KEY using index "kwenta_push_subscriptions_pkey";

alter table "public"."kwenta_recurring" add constraint "kwenta_recurring_pkey" PRIMARY KEY using index "kwenta_recurring_pkey";

alter table "public"."kwenta_salary" add constraint "kwenta_salary_pkey" PRIMARY KEY using index "kwenta_salary_pkey";

alter table "public"."kwenta_transactions" add constraint "kwenta_transactions_pkey" PRIMARY KEY using index "kwenta_transactions_pkey";

alter table "public"."kwenta_bill_reminders_sent" add constraint "kwenta_bill_reminders_sent_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_bill_reminders_sent" validate constraint "kwenta_bill_reminders_sent_user_id_fkey";

alter table "public"."kwenta_bills" add constraint "kwenta_bills_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_bills" validate constraint "kwenta_bills_household_id_fkey";

alter table "public"."kwenta_bills" add constraint "kwenta_bills_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_bills" validate constraint "kwenta_bills_user_id_fkey";

alter table "public"."kwenta_budget_alert_log" add constraint "kwenta_budget_alert_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_budget_alert_log" validate constraint "kwenta_budget_alert_log_user_id_fkey";

alter table "public"."kwenta_budgets" add constraint "kwenta_budgets_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_budgets" validate constraint "kwenta_budgets_household_id_fkey";

alter table "public"."kwenta_budgets" add constraint "kwenta_budgets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_budgets" validate constraint "kwenta_budgets_user_id_fkey";

alter table "public"."kwenta_custom_categories" add constraint "kwenta_cc_color_safe" CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text)) NOT VALID not valid;

alter table "public"."kwenta_custom_categories" validate constraint "kwenta_cc_color_safe";

alter table "public"."kwenta_custom_categories" add constraint "kwenta_cc_icon_safe" CHECK (((icon IS NULL) OR (icon ~ '^[a-z0-9_-]{1,32}$'::text))) NOT VALID not valid;

alter table "public"."kwenta_custom_categories" validate constraint "kwenta_cc_icon_safe";

alter table "public"."kwenta_custom_categories" add constraint "kwenta_cc_id_safe" CHECK ((id ~ '^[A-Za-z0-9_-]{1,64}$'::text)) NOT VALID not valid;

alter table "public"."kwenta_custom_categories" validate constraint "kwenta_cc_id_safe";

alter table "public"."kwenta_custom_categories" add constraint "kwenta_cc_label_len" CHECK (((char_length(label) >= 1) AND (char_length(label) <= 40))) NOT VALID not valid;

alter table "public"."kwenta_custom_categories" validate constraint "kwenta_cc_label_len";

alter table "public"."kwenta_custom_categories" add constraint "kwenta_custom_categories_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_custom_categories" validate constraint "kwenta_custom_categories_household_id_fkey";

alter table "public"."kwenta_custom_categories" add constraint "kwenta_custom_categories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_custom_categories" validate constraint "kwenta_custom_categories_user_id_fkey";

alter table "public"."kwenta_goals" add constraint "kwenta_goals_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_goals" validate constraint "kwenta_goals_household_id_fkey";

alter table "public"."kwenta_goals" add constraint "kwenta_goals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_goals" validate constraint "kwenta_goals_user_id_fkey";

alter table "public"."kwenta_household_activity" add constraint "kwenta_household_activity_action_check" CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text]))) not valid;

alter table "public"."kwenta_household_activity" validate constraint "kwenta_household_activity_action_check";

alter table "public"."kwenta_household_activity" add constraint "kwenta_household_activity_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_household_activity" validate constraint "kwenta_household_activity_household_id_fkey";

alter table "public"."kwenta_household_activity" add constraint "kwenta_household_activity_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."kwenta_household_activity" validate constraint "kwenta_household_activity_user_id_fkey";

alter table "public"."kwenta_household_members" add constraint "kwenta_household_members_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_household_members" validate constraint "kwenta_household_members_household_id_fkey";

alter table "public"."kwenta_household_members" add constraint "kwenta_household_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_household_members" validate constraint "kwenta_household_members_user_id_fkey";

alter table "public"."kwenta_households" add constraint "kwenta_households_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."kwenta_households" validate constraint "kwenta_households_created_by_fkey";

alter table "public"."kwenta_households" add constraint "kwenta_households_invite_code_key" UNIQUE using index "kwenta_households_invite_code_key";

alter table "public"."kwenta_join_attempts" add constraint "kwenta_join_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_join_attempts" validate constraint "kwenta_join_attempts_user_id_fkey";

alter table "public"."kwenta_loans" add constraint "kwenta_loans_direction_check" CHECK ((direction = ANY (ARRAY['lent'::text, 'borrowed'::text]))) not valid;

alter table "public"."kwenta_loans" validate constraint "kwenta_loans_direction_check";

alter table "public"."kwenta_loans" add constraint "kwenta_loans_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_loans" validate constraint "kwenta_loans_household_id_fkey";

alter table "public"."kwenta_loans" add constraint "kwenta_loans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_loans" validate constraint "kwenta_loans_user_id_fkey";

alter table "public"."kwenta_mfa_recovery_codes" add constraint "kwenta_mfa_recovery_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_mfa_recovery_codes" validate constraint "kwenta_mfa_recovery_codes_user_id_fkey";

alter table "public"."kwenta_password_checks" add constraint "kwenta_password_checks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_password_checks" validate constraint "kwenta_password_checks_user_id_fkey";

alter table "public"."kwenta_push_subscriptions" add constraint "kwenta_push_subscriptions_endpoint_key" UNIQUE using index "kwenta_push_subscriptions_endpoint_key";

alter table "public"."kwenta_push_subscriptions" add constraint "kwenta_push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_push_subscriptions" validate constraint "kwenta_push_subscriptions_user_id_fkey";

alter table "public"."kwenta_recurring" add constraint "kwenta_recurring_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_recurring" validate constraint "kwenta_recurring_household_id_fkey";

alter table "public"."kwenta_recurring" add constraint "kwenta_recurring_type_check" CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text]))) not valid;

alter table "public"."kwenta_recurring" validate constraint "kwenta_recurring_type_check";

alter table "public"."kwenta_recurring" add constraint "kwenta_recurring_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_recurring" validate constraint "kwenta_recurring_user_id_fkey";

alter table "public"."kwenta_salary" add constraint "kwenta_salary_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_salary" validate constraint "kwenta_salary_user_id_fkey";

alter table "public"."kwenta_transactions" add constraint "kwenta_transactions_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.kwenta_households(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_transactions" validate constraint "kwenta_transactions_household_id_fkey";

alter table "public"."kwenta_transactions" add constraint "kwenta_transactions_type_check" CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text]))) not valid;

alter table "public"."kwenta_transactions" validate constraint "kwenta_transactions_type_check";

alter table "public"."kwenta_transactions" add constraint "kwenta_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwenta_transactions" validate constraint "kwenta_transactions_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._kwenta_current_user_email(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_user_id;
  return coalesce(v_email, 'Unknown');
end;
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_log_bill_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_log_budget_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_log_goal_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_log_loan_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_log_recurring_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_log_transaction_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_push_config()
 RETURNS TABLE(project_url text, push_secret text)
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  return query select
    'https://YOUR-PROJECT-REF.supabase.co'::text,
    'YOUR-PUSH-FUNCTION-SECRET'::text;
end;
$function$
;

CREATE OR REPLACE FUNCTION public._kwenta_send_push(p_endpoint text, p_p256dh text, p_auth text, p_title text, p_body text, p_url text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  cfg record;
begin
  select * into cfg from _kwenta_push_config();
  perform net.http_post(
    url := cfg.project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg.push_secret
    ),
    body := jsonb_build_object(
      'subscription', jsonb_build_object(
        'endpoint', p_endpoint,
        'keys', jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth)
      ),
      'title', p_title,
      'body', p_body,
      'url', p_url
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_budget_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  budget_amount numeric;
  spent_total numeric;
  month_key text;
begin
  if new.type <> 'expense' or new.goal_id is not null or new.loan_id is not null then
    return new; -- only real expenses count toward budgets — matches the
                -- app's own balance-separation rule for goals/utang
  end if;

  month_key := to_char(new.date::date, 'YYYY-MM');

  select amount into budget_amount
  from kwenta_budgets
  where user_id = new.user_id and category = new.category;

  if budget_amount is null then
    return new; -- no budget set for this category
  end if;

  select coalesce(sum(amount), 0) into spent_total
  from kwenta_transactions
  where user_id = new.user_id
    and category = new.category
    and type = 'expense'
    and goal_id is null and loan_id is null
    and to_char(date::date, 'YYYY-MM') = month_key;

  if spent_total > budget_amount then
    perform notify_user_push(
      new.user_id,
      'Budget alert',
      'You''ve spent ' || to_char(spent_total, 'FM999,999,990.00') || ' on ' || new.category ||
        ' this month — ' || to_char(spent_total - budget_amount, 'FM999,999,990.00') || ' over your budget.',
      '/'
    );
  end if;

  return new;
exception when others then
  raise warning 'check_budget_alert failed (non-fatal): %', sqlerrm;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_upcoming_bills()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  bill record;
  month_key text;
  today_day int;
  paid boolean;
begin
  month_key := to_char(now(), 'YYYY-MM');
  today_day := extract(day from now());

  for bill in
    select id, user_id, name, custom_category, due_day
    from kwenta_bills
    where due_day between today_day and today_day + 3
  loop
    select exists (
      select 1 from kwenta_transactions
      where bill_id = bill.id and to_char(date::date, 'YYYY-MM') = month_key
    ) into paid;

    if paid then
      continue;
    end if;

    begin
      insert into kwenta_bill_reminders_sent (user_id, bill_id, month_key)
      values (bill.user_id, bill.id, month_key);
      perform notify_user_push(
        bill.user_id,
        'Bill due soon',
        coalesce(bill.name, bill.custom_category, 'A bill') || ' is due on the ' || bill.due_day || 'th.',
        '/'
      );
    exception when unique_violation then
      null; -- already reminded this month
    end;
  end loop;
exception when others then
  raise warning 'check_upcoming_bills failed (non-fatal): %', sqlerrm;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.count_remaining_mfa_recovery_codes()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select count(*)::int from kwenta_mfa_recovery_codes
  where user_id = auth.uid() and used_at is null;
$function$
;

CREATE OR REPLACE FUNCTION public.create_household(household_name text)
 RETURNS TABLE(id uuid, name text, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not kwenta_mfa_ok() then raise exception 'Two-factor verification required'; end if;
  if household_name is null or char_length(trim(household_name)) not between 1 and 60 then
    raise exception 'Household name must be 1-60 characters';
  end if;
  if exists (select 1 from kwenta_household_members where user_id = v_uid) then
    raise exception 'Leave your current household first';
  end if;

  insert into kwenta_households (name, invite_code, invite_expires_at, created_by)
  values (trim(household_name), kwenta_new_invite_code(), now() + interval '7 days', v_uid)
  returning kwenta_households.id into v_id;

  insert into kwenta_household_members (household_id, user_id) values (v_id, v_uid);

  return query
    select h.id, h.name, h.invite_code, h.invite_expires_at
    from kwenta_households h where h.id = v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_my_account_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  delete from kwenta_household_members where user_id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_mfa_recovery_codes()
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  codes text[] := array[]::text[];
  new_code text;
  i int;
begin
  delete from kwenta_mfa_recovery_codes where user_id = auth.uid();

  for i in 1..8 loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
                upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    codes := array_append(codes, new_code);
    insert into kwenta_mfa_recovery_codes (user_id, code_hash)
    values (auth.uid(), extensions.crypt(new_code, extensions.gen_salt('bf')));
  end loop;

  return codes;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_verified_mfa()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from auth.mfa_factors
    where user_id = auth.uid() and status = 'verified'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_household_member(hh_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from kwenta_household_members
    where household_id = hh_id and user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.join_household_by_code(code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_hid uuid;
  v_recent int;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not kwenta_mfa_ok() then raise exception 'Two-factor verification required'; end if;

  select count(*) into v_recent
  from kwenta_join_attempts
  where user_id = v_uid and attempted_at > now() - interval '15 minutes';
  if v_recent >= 5 then
    return 'rate_limited';
  end if;

  insert into kwenta_join_attempts (user_id) values (v_uid);
  delete from kwenta_join_attempts where attempted_at < now() - interval '1 day';

  if exists (select 1 from kwenta_household_members where user_id = v_uid) then
    return 'in_household';
  end if;

  select id into v_hid
  from kwenta_households
  where upper(invite_code) = upper(trim(coalesce(code, '')))
    and invite_expires_at > now();
  if v_hid is null then
    return 'invalid';
  end if;

  insert into kwenta_household_members (household_id, user_id) values (v_hid, v_uid);
  return 'ok';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kwenta_mfa_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = auth.uid() and status = 'verified'
      );
$function$
;

CREATE OR REPLACE FUNCTION public.kwenta_new_invite_code()
 RETURNS text
 LANGUAGE sql
AS $function$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$function$
;

CREATE OR REPLACE FUNCTION public.kwenta_prune_household_activity()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  delete from kwenta_household_activity where created_at < now() - interval '180 days';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kwenta_send_bill_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  bill_row record;
  sub_row record;
  today_day int := extract(day from current_date);
  days_until int;
begin
  for bill_row in
    select b.id, b.user_id, b.name, b.due_day, b.estimated_amount
    from kwenta_bills b
    where b.active is not false
  loop
    days_until := bill_row.due_day - today_day;

    if days_until = 3 or days_until = 0 then
      if not exists (
        select 1 from kwenta_transactions t
        where t.bill_id = bill_row.id
          and date_trunc('month', t.date::date) = date_trunc('month', current_date)
      ) then
        for sub_row in
          select endpoint, p256dh, auth_key
          from kwenta_push_subscriptions
          where user_id = bill_row.user_id
        loop
          perform _kwenta_send_push(
            sub_row.endpoint,
            sub_row.p256dh,
            sub_row.auth_key,
            'Bill due ' || case when days_until = 0 then 'today' else 'in 3 days' end,
            bill_row.name || case
              when bill_row.estimated_amount is not null
                then ' — around ₱' || to_char(bill_row.estimated_amount, 'FM999,999,990.00')
              else ''
            end,
            '/'
          );
        end loop;
      end if;
    end if;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kwenta_send_budget_alerts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  budget_row record;
  spent numeric;
  sub_row record;
  current_month_key text := to_char(current_date, 'YYYY-MM');
begin
  for budget_row in
    select user_id, category, amount
    from kwenta_budgets
    where amount is not null and amount > 0
  loop
    select coalesce(sum(amount), 0) into spent
    from kwenta_transactions
    where user_id = budget_row.user_id
      and category = budget_row.category
      and type = 'expense'
      and date_trunc('month', date::date) = date_trunc('month', current_date)
      and goal_id is null
      and loan_id is null;

    if spent > budget_row.amount then
      if not exists (
        select 1 from kwenta_budget_alert_log
        where user_id = budget_row.user_id
          and category = budget_row.category
          and month_key = current_month_key
      ) then
        for sub_row in
          select endpoint, p256dh, auth_key
          from kwenta_push_subscriptions
          where user_id = budget_row.user_id
        loop
          perform _kwenta_send_push(
            sub_row.endpoint,
            sub_row.p256dh,
            sub_row.auth_key,
            'Over budget',
            'You''ve gone over your ' || budget_row.category || ' budget this month.',
            '/'
          );
        end loop;

        insert into kwenta_budget_alert_log (user_id, category, month_key)
        values (budget_row.user_id, budget_row.category, current_month_key)
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_household_members(p_household_id uuid)
 RETURNS TABLE(user_id uuid, email text, is_owner boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not kwenta_mfa_ok() then raise exception 'Two-factor verification required'; end if;
  if not exists (
    select 1 from kwenta_household_members
    where household_id = p_household_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of that household';
  end if;

  return query
    select m.user_id, coalesce(u.email, 'Unknown')::text, (h.created_by = m.user_id)
    from kwenta_household_members m
    join kwenta_households h on h.id = m.household_id
    left join auth.users u on u.id = m.user_id
    where m.household_id = p_household_id
    order by (h.created_by = m.user_id) desc, u.email;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_my_sessions()
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, user_agent text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
begin
  begin
    return query
      select s.id, s.created_at, s.updated_at, s.user_agent
      from auth.sessions s
      where s.user_id = auth.uid()
      order by s.updated_at desc nulls last;
  exception when undefined_column then
    return query
      select s.id, s.created_at, s.updated_at, null::text
      from auth.sessions s
      where s.user_id = auth.uid()
      order by s.updated_at desc nulls last;
  end;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_user_push(target_user_id uuid, title text, body text, url text DEFAULT '/'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  sub record;
  function_url text;
  function_secret text;
begin
  select value into function_url from kwenta_app_settings where key = 'push_function_url';
  select value into function_secret from kwenta_app_settings where key = 'push_function_secret';

  if function_url is null or function_secret is null then
    return; -- not configured yet — no-op rather than error, see setup note above
  end if;

  for sub in select endpoint, p256dh, auth_key from kwenta_push_subscriptions where user_id = target_user_id
  loop
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', function_secret),
      body := jsonb_build_object(
        'subscription', jsonb_build_object(
          'endpoint', sub.endpoint,
          'keys', jsonb_build_object('p256dh', sub.p256dh, 'auth', sub.auth_key)
        ),
        'title', title,
        'body', body,
        'url', url
      )
    );
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.regenerate_invite_code(p_household_id uuid)
 RETURNS TABLE(invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not kwenta_mfa_ok() then raise exception 'Two-factor verification required'; end if;
  if not exists (select 1 from kwenta_households where id = p_household_id and created_by = v_uid) then
    raise exception 'Only the household owner can do that';
  end if;

  update kwenta_households
    set invite_code = kwenta_new_invite_code(),
        invite_expires_at = now() + interval '7 days'
    where id = p_household_id;

  return query
    select h.invite_code, h.invite_expires_at from kwenta_households h where h.id = p_household_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_household_member(p_household_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not kwenta_mfa_ok() then raise exception 'Two-factor verification required'; end if;
  if not exists (select 1 from kwenta_households where id = p_household_id and created_by = v_uid) then
    raise exception 'Only the household owner can remove members';
  end if;
  if p_user_id = v_uid then
    raise exception 'Use "Leave household" to remove yourself';
  end if;
  delete from kwenta_household_members
    where household_id = p_household_id and user_id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_my_data(payload jsonb, p_household_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  -- security definer bypasses RLS, so enforce 2FA here too (function is
  -- created in phase2_security.sql; skipped harmlessly if not there yet).
  if to_regprocedure('kwenta_mfa_ok()') is not null then
    if not kwenta_mfa_ok() then
      raise exception 'Two-factor verification required';
    end if;
  end if;
  if p_household_id is not null and not is_household_member(p_household_id) then
    raise exception 'Not a member of that household';
  end if;

  -- wipe (children before parents, same order as wipe_my_data)
  delete from kwenta_transactions       where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_recurring          where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_bills              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_goals              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_loans              where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_budgets            where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_custom_categories  where user_id = v_uid and household_id is not distinct from p_household_id;
  delete from kwenta_salary             where user_id = v_uid;

  -- re-insert (parents before children). user_id / household_id are forced
  -- server-side, so a crafted payload can't write into someone else's data.
  insert into kwenta_salary (user_id, month_key, amount)
  select v_uid, month_key, amount
  from jsonb_populate_recordset(null::kwenta_salary, coalesce(payload->'salary', '[]'::jsonb));

  insert into kwenta_custom_categories (id, user_id, household_id, label, color, icon, active)
  select id, v_uid, p_household_id, label, color, icon, coalesce(active, true)
  from jsonb_populate_recordset(null::kwenta_custom_categories, coalesce(payload->'custom_categories', '[]'::jsonb));

  insert into kwenta_budgets (user_id, household_id, category, amount, amount_second)
  select v_uid, p_household_id, category, coalesce(amount, 0), amount_second
  from jsonb_populate_recordset(null::kwenta_budgets, coalesce(payload->'budgets', '[]'::jsonb));

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
                                   recurring_id, bill_id, goal_id, loan_id, loan_kind, tags)
  select id, v_uid, p_household_id, type, coalesce(description, ''), amount, category, date,
         recurring_id, bill_id, goal_id, loan_id, loan_kind, tags
  from jsonb_populate_recordset(null::kwenta_transactions, coalesce(payload->'transactions', '[]'::jsonb));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.session_satisfies_mfa()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select (not has_verified_mfa()) or (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');
$function$
;

CREATE OR REPLACE FUNCTION public.verify_mfa_recovery_code(input_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  match_id uuid;
begin
  select id into match_id
  from kwenta_mfa_recovery_codes
  where user_id = auth.uid()
    and used_at is null
    and code_hash = extensions.crypt(input_code, code_hash)
  limit 1;

  if match_id is null then
    return false;
  end if;

  update kwenta_mfa_recovery_codes set used_at = now() where id = match_id;
  delete from auth.mfa_factors where user_id = auth.uid();
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_my_password(p_password text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_fails int;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select count(*) into v_fails
  from kwenta_password_checks
  where user_id = v_uid and checked_at > now() - interval '15 minutes';
  if v_fails >= 5 then
    return 'locked';
  end if;

  select encrypted_password into v_hash from auth.users where id = v_uid;
  if v_hash is null or v_hash = '' then
    return 'no_password';
  end if;

  if crypt(coalesce(p_password, ''), v_hash) = v_hash then
    delete from kwenta_password_checks where user_id = v_uid;
    return 'ok';
  end if;

  insert into kwenta_password_checks (user_id) values (v_uid);
  delete from kwenta_password_checks where checked_at < now() - interval '1 day';
  return 'wrong';
end;
$function$
;

grant delete on table "public"."kwenta_app_settings" to "anon";

grant insert on table "public"."kwenta_app_settings" to "anon";

grant references on table "public"."kwenta_app_settings" to "anon";

grant select on table "public"."kwenta_app_settings" to "anon";

grant trigger on table "public"."kwenta_app_settings" to "anon";

grant truncate on table "public"."kwenta_app_settings" to "anon";

grant update on table "public"."kwenta_app_settings" to "anon";

grant delete on table "public"."kwenta_app_settings" to "authenticated";

grant insert on table "public"."kwenta_app_settings" to "authenticated";

grant references on table "public"."kwenta_app_settings" to "authenticated";

grant select on table "public"."kwenta_app_settings" to "authenticated";

grant trigger on table "public"."kwenta_app_settings" to "authenticated";

grant truncate on table "public"."kwenta_app_settings" to "authenticated";

grant update on table "public"."kwenta_app_settings" to "authenticated";

grant delete on table "public"."kwenta_app_settings" to "service_role";

grant insert on table "public"."kwenta_app_settings" to "service_role";

grant references on table "public"."kwenta_app_settings" to "service_role";

grant select on table "public"."kwenta_app_settings" to "service_role";

grant trigger on table "public"."kwenta_app_settings" to "service_role";

grant truncate on table "public"."kwenta_app_settings" to "service_role";

grant update on table "public"."kwenta_app_settings" to "service_role";

grant delete on table "public"."kwenta_bill_reminders_sent" to "anon";

grant insert on table "public"."kwenta_bill_reminders_sent" to "anon";

grant references on table "public"."kwenta_bill_reminders_sent" to "anon";

grant select on table "public"."kwenta_bill_reminders_sent" to "anon";

grant trigger on table "public"."kwenta_bill_reminders_sent" to "anon";

grant truncate on table "public"."kwenta_bill_reminders_sent" to "anon";

grant update on table "public"."kwenta_bill_reminders_sent" to "anon";

grant delete on table "public"."kwenta_bill_reminders_sent" to "authenticated";

grant insert on table "public"."kwenta_bill_reminders_sent" to "authenticated";

grant references on table "public"."kwenta_bill_reminders_sent" to "authenticated";

grant select on table "public"."kwenta_bill_reminders_sent" to "authenticated";

grant trigger on table "public"."kwenta_bill_reminders_sent" to "authenticated";

grant truncate on table "public"."kwenta_bill_reminders_sent" to "authenticated";

grant update on table "public"."kwenta_bill_reminders_sent" to "authenticated";

grant delete on table "public"."kwenta_bill_reminders_sent" to "service_role";

grant insert on table "public"."kwenta_bill_reminders_sent" to "service_role";

grant references on table "public"."kwenta_bill_reminders_sent" to "service_role";

grant select on table "public"."kwenta_bill_reminders_sent" to "service_role";

grant trigger on table "public"."kwenta_bill_reminders_sent" to "service_role";

grant truncate on table "public"."kwenta_bill_reminders_sent" to "service_role";

grant update on table "public"."kwenta_bill_reminders_sent" to "service_role";

grant delete on table "public"."kwenta_bills" to "anon";

grant insert on table "public"."kwenta_bills" to "anon";

grant references on table "public"."kwenta_bills" to "anon";

grant select on table "public"."kwenta_bills" to "anon";

grant trigger on table "public"."kwenta_bills" to "anon";

grant truncate on table "public"."kwenta_bills" to "anon";

grant update on table "public"."kwenta_bills" to "anon";

grant delete on table "public"."kwenta_bills" to "authenticated";

grant insert on table "public"."kwenta_bills" to "authenticated";

grant references on table "public"."kwenta_bills" to "authenticated";

grant select on table "public"."kwenta_bills" to "authenticated";

grant trigger on table "public"."kwenta_bills" to "authenticated";

grant truncate on table "public"."kwenta_bills" to "authenticated";

grant update on table "public"."kwenta_bills" to "authenticated";

grant delete on table "public"."kwenta_bills" to "service_role";

grant insert on table "public"."kwenta_bills" to "service_role";

grant references on table "public"."kwenta_bills" to "service_role";

grant select on table "public"."kwenta_bills" to "service_role";

grant trigger on table "public"."kwenta_bills" to "service_role";

grant truncate on table "public"."kwenta_bills" to "service_role";

grant update on table "public"."kwenta_bills" to "service_role";

grant delete on table "public"."kwenta_budget_alert_log" to "anon";

grant insert on table "public"."kwenta_budget_alert_log" to "anon";

grant references on table "public"."kwenta_budget_alert_log" to "anon";

grant select on table "public"."kwenta_budget_alert_log" to "anon";

grant trigger on table "public"."kwenta_budget_alert_log" to "anon";

grant truncate on table "public"."kwenta_budget_alert_log" to "anon";

grant update on table "public"."kwenta_budget_alert_log" to "anon";

grant delete on table "public"."kwenta_budget_alert_log" to "authenticated";

grant insert on table "public"."kwenta_budget_alert_log" to "authenticated";

grant references on table "public"."kwenta_budget_alert_log" to "authenticated";

grant select on table "public"."kwenta_budget_alert_log" to "authenticated";

grant trigger on table "public"."kwenta_budget_alert_log" to "authenticated";

grant truncate on table "public"."kwenta_budget_alert_log" to "authenticated";

grant update on table "public"."kwenta_budget_alert_log" to "authenticated";

grant delete on table "public"."kwenta_budget_alert_log" to "service_role";

grant insert on table "public"."kwenta_budget_alert_log" to "service_role";

grant references on table "public"."kwenta_budget_alert_log" to "service_role";

grant select on table "public"."kwenta_budget_alert_log" to "service_role";

grant trigger on table "public"."kwenta_budget_alert_log" to "service_role";

grant truncate on table "public"."kwenta_budget_alert_log" to "service_role";

grant update on table "public"."kwenta_budget_alert_log" to "service_role";

grant delete on table "public"."kwenta_budgets" to "anon";

grant insert on table "public"."kwenta_budgets" to "anon";

grant references on table "public"."kwenta_budgets" to "anon";

grant select on table "public"."kwenta_budgets" to "anon";

grant trigger on table "public"."kwenta_budgets" to "anon";

grant truncate on table "public"."kwenta_budgets" to "anon";

grant update on table "public"."kwenta_budgets" to "anon";

grant delete on table "public"."kwenta_budgets" to "authenticated";

grant insert on table "public"."kwenta_budgets" to "authenticated";

grant references on table "public"."kwenta_budgets" to "authenticated";

grant select on table "public"."kwenta_budgets" to "authenticated";

grant trigger on table "public"."kwenta_budgets" to "authenticated";

grant truncate on table "public"."kwenta_budgets" to "authenticated";

grant update on table "public"."kwenta_budgets" to "authenticated";

grant delete on table "public"."kwenta_budgets" to "service_role";

grant insert on table "public"."kwenta_budgets" to "service_role";

grant references on table "public"."kwenta_budgets" to "service_role";

grant select on table "public"."kwenta_budgets" to "service_role";

grant trigger on table "public"."kwenta_budgets" to "service_role";

grant truncate on table "public"."kwenta_budgets" to "service_role";

grant update on table "public"."kwenta_budgets" to "service_role";

grant delete on table "public"."kwenta_custom_categories" to "anon";

grant insert on table "public"."kwenta_custom_categories" to "anon";

grant references on table "public"."kwenta_custom_categories" to "anon";

grant select on table "public"."kwenta_custom_categories" to "anon";

grant trigger on table "public"."kwenta_custom_categories" to "anon";

grant truncate on table "public"."kwenta_custom_categories" to "anon";

grant update on table "public"."kwenta_custom_categories" to "anon";

grant delete on table "public"."kwenta_custom_categories" to "authenticated";

grant insert on table "public"."kwenta_custom_categories" to "authenticated";

grant references on table "public"."kwenta_custom_categories" to "authenticated";

grant select on table "public"."kwenta_custom_categories" to "authenticated";

grant trigger on table "public"."kwenta_custom_categories" to "authenticated";

grant truncate on table "public"."kwenta_custom_categories" to "authenticated";

grant update on table "public"."kwenta_custom_categories" to "authenticated";

grant delete on table "public"."kwenta_custom_categories" to "service_role";

grant insert on table "public"."kwenta_custom_categories" to "service_role";

grant references on table "public"."kwenta_custom_categories" to "service_role";

grant select on table "public"."kwenta_custom_categories" to "service_role";

grant trigger on table "public"."kwenta_custom_categories" to "service_role";

grant truncate on table "public"."kwenta_custom_categories" to "service_role";

grant update on table "public"."kwenta_custom_categories" to "service_role";

grant delete on table "public"."kwenta_goals" to "anon";

grant insert on table "public"."kwenta_goals" to "anon";

grant references on table "public"."kwenta_goals" to "anon";

grant select on table "public"."kwenta_goals" to "anon";

grant trigger on table "public"."kwenta_goals" to "anon";

grant truncate on table "public"."kwenta_goals" to "anon";

grant update on table "public"."kwenta_goals" to "anon";

grant delete on table "public"."kwenta_goals" to "authenticated";

grant insert on table "public"."kwenta_goals" to "authenticated";

grant references on table "public"."kwenta_goals" to "authenticated";

grant select on table "public"."kwenta_goals" to "authenticated";

grant trigger on table "public"."kwenta_goals" to "authenticated";

grant truncate on table "public"."kwenta_goals" to "authenticated";

grant update on table "public"."kwenta_goals" to "authenticated";

grant delete on table "public"."kwenta_goals" to "service_role";

grant insert on table "public"."kwenta_goals" to "service_role";

grant references on table "public"."kwenta_goals" to "service_role";

grant select on table "public"."kwenta_goals" to "service_role";

grant trigger on table "public"."kwenta_goals" to "service_role";

grant truncate on table "public"."kwenta_goals" to "service_role";

grant update on table "public"."kwenta_goals" to "service_role";

grant delete on table "public"."kwenta_household_activity" to "anon";

grant insert on table "public"."kwenta_household_activity" to "anon";

grant references on table "public"."kwenta_household_activity" to "anon";

grant select on table "public"."kwenta_household_activity" to "anon";

grant trigger on table "public"."kwenta_household_activity" to "anon";

grant truncate on table "public"."kwenta_household_activity" to "anon";

grant update on table "public"."kwenta_household_activity" to "anon";

grant delete on table "public"."kwenta_household_activity" to "authenticated";

grant insert on table "public"."kwenta_household_activity" to "authenticated";

grant references on table "public"."kwenta_household_activity" to "authenticated";

grant select on table "public"."kwenta_household_activity" to "authenticated";

grant trigger on table "public"."kwenta_household_activity" to "authenticated";

grant truncate on table "public"."kwenta_household_activity" to "authenticated";

grant update on table "public"."kwenta_household_activity" to "authenticated";

grant delete on table "public"."kwenta_household_activity" to "service_role";

grant insert on table "public"."kwenta_household_activity" to "service_role";

grant references on table "public"."kwenta_household_activity" to "service_role";

grant select on table "public"."kwenta_household_activity" to "service_role";

grant trigger on table "public"."kwenta_household_activity" to "service_role";

grant truncate on table "public"."kwenta_household_activity" to "service_role";

grant update on table "public"."kwenta_household_activity" to "service_role";

grant delete on table "public"."kwenta_household_members" to "anon";

grant insert on table "public"."kwenta_household_members" to "anon";

grant references on table "public"."kwenta_household_members" to "anon";

grant select on table "public"."kwenta_household_members" to "anon";

grant trigger on table "public"."kwenta_household_members" to "anon";

grant truncate on table "public"."kwenta_household_members" to "anon";

grant update on table "public"."kwenta_household_members" to "anon";

grant delete on table "public"."kwenta_household_members" to "authenticated";

grant insert on table "public"."kwenta_household_members" to "authenticated";

grant references on table "public"."kwenta_household_members" to "authenticated";

grant select on table "public"."kwenta_household_members" to "authenticated";

grant trigger on table "public"."kwenta_household_members" to "authenticated";

grant truncate on table "public"."kwenta_household_members" to "authenticated";

grant update on table "public"."kwenta_household_members" to "authenticated";

grant delete on table "public"."kwenta_household_members" to "service_role";

grant insert on table "public"."kwenta_household_members" to "service_role";

grant references on table "public"."kwenta_household_members" to "service_role";

grant select on table "public"."kwenta_household_members" to "service_role";

grant trigger on table "public"."kwenta_household_members" to "service_role";

grant truncate on table "public"."kwenta_household_members" to "service_role";

grant update on table "public"."kwenta_household_members" to "service_role";

grant delete on table "public"."kwenta_households" to "anon";

grant insert on table "public"."kwenta_households" to "anon";

grant references on table "public"."kwenta_households" to "anon";

grant select on table "public"."kwenta_households" to "anon";

grant trigger on table "public"."kwenta_households" to "anon";

grant truncate on table "public"."kwenta_households" to "anon";

grant update on table "public"."kwenta_households" to "anon";

grant delete on table "public"."kwenta_households" to "authenticated";

grant insert on table "public"."kwenta_households" to "authenticated";

grant references on table "public"."kwenta_households" to "authenticated";

grant select on table "public"."kwenta_households" to "authenticated";

grant trigger on table "public"."kwenta_households" to "authenticated";

grant truncate on table "public"."kwenta_households" to "authenticated";

grant update on table "public"."kwenta_households" to "authenticated";

grant delete on table "public"."kwenta_households" to "service_role";

grant insert on table "public"."kwenta_households" to "service_role";

grant references on table "public"."kwenta_households" to "service_role";

grant select on table "public"."kwenta_households" to "service_role";

grant trigger on table "public"."kwenta_households" to "service_role";

grant truncate on table "public"."kwenta_households" to "service_role";

grant update on table "public"."kwenta_households" to "service_role";

grant delete on table "public"."kwenta_join_attempts" to "anon";

grant insert on table "public"."kwenta_join_attempts" to "anon";

grant references on table "public"."kwenta_join_attempts" to "anon";

grant select on table "public"."kwenta_join_attempts" to "anon";

grant trigger on table "public"."kwenta_join_attempts" to "anon";

grant truncate on table "public"."kwenta_join_attempts" to "anon";

grant update on table "public"."kwenta_join_attempts" to "anon";

grant delete on table "public"."kwenta_join_attempts" to "authenticated";

grant insert on table "public"."kwenta_join_attempts" to "authenticated";

grant references on table "public"."kwenta_join_attempts" to "authenticated";

grant select on table "public"."kwenta_join_attempts" to "authenticated";

grant trigger on table "public"."kwenta_join_attempts" to "authenticated";

grant truncate on table "public"."kwenta_join_attempts" to "authenticated";

grant update on table "public"."kwenta_join_attempts" to "authenticated";

grant delete on table "public"."kwenta_join_attempts" to "service_role";

grant insert on table "public"."kwenta_join_attempts" to "service_role";

grant references on table "public"."kwenta_join_attempts" to "service_role";

grant select on table "public"."kwenta_join_attempts" to "service_role";

grant trigger on table "public"."kwenta_join_attempts" to "service_role";

grant truncate on table "public"."kwenta_join_attempts" to "service_role";

grant update on table "public"."kwenta_join_attempts" to "service_role";

grant delete on table "public"."kwenta_loans" to "anon";

grant insert on table "public"."kwenta_loans" to "anon";

grant references on table "public"."kwenta_loans" to "anon";

grant select on table "public"."kwenta_loans" to "anon";

grant trigger on table "public"."kwenta_loans" to "anon";

grant truncate on table "public"."kwenta_loans" to "anon";

grant update on table "public"."kwenta_loans" to "anon";

grant delete on table "public"."kwenta_loans" to "authenticated";

grant insert on table "public"."kwenta_loans" to "authenticated";

grant references on table "public"."kwenta_loans" to "authenticated";

grant select on table "public"."kwenta_loans" to "authenticated";

grant trigger on table "public"."kwenta_loans" to "authenticated";

grant truncate on table "public"."kwenta_loans" to "authenticated";

grant update on table "public"."kwenta_loans" to "authenticated";

grant delete on table "public"."kwenta_loans" to "service_role";

grant insert on table "public"."kwenta_loans" to "service_role";

grant references on table "public"."kwenta_loans" to "service_role";

grant select on table "public"."kwenta_loans" to "service_role";

grant trigger on table "public"."kwenta_loans" to "service_role";

grant truncate on table "public"."kwenta_loans" to "service_role";

grant update on table "public"."kwenta_loans" to "service_role";

grant delete on table "public"."kwenta_mfa_recovery_codes" to "anon";

grant insert on table "public"."kwenta_mfa_recovery_codes" to "anon";

grant references on table "public"."kwenta_mfa_recovery_codes" to "anon";

grant select on table "public"."kwenta_mfa_recovery_codes" to "anon";

grant trigger on table "public"."kwenta_mfa_recovery_codes" to "anon";

grant truncate on table "public"."kwenta_mfa_recovery_codes" to "anon";

grant update on table "public"."kwenta_mfa_recovery_codes" to "anon";

grant delete on table "public"."kwenta_mfa_recovery_codes" to "authenticated";

grant insert on table "public"."kwenta_mfa_recovery_codes" to "authenticated";

grant references on table "public"."kwenta_mfa_recovery_codes" to "authenticated";

grant select on table "public"."kwenta_mfa_recovery_codes" to "authenticated";

grant trigger on table "public"."kwenta_mfa_recovery_codes" to "authenticated";

grant truncate on table "public"."kwenta_mfa_recovery_codes" to "authenticated";

grant update on table "public"."kwenta_mfa_recovery_codes" to "authenticated";

grant delete on table "public"."kwenta_mfa_recovery_codes" to "service_role";

grant insert on table "public"."kwenta_mfa_recovery_codes" to "service_role";

grant references on table "public"."kwenta_mfa_recovery_codes" to "service_role";

grant select on table "public"."kwenta_mfa_recovery_codes" to "service_role";

grant trigger on table "public"."kwenta_mfa_recovery_codes" to "service_role";

grant truncate on table "public"."kwenta_mfa_recovery_codes" to "service_role";

grant update on table "public"."kwenta_mfa_recovery_codes" to "service_role";

grant delete on table "public"."kwenta_password_checks" to "anon";

grant insert on table "public"."kwenta_password_checks" to "anon";

grant references on table "public"."kwenta_password_checks" to "anon";

grant select on table "public"."kwenta_password_checks" to "anon";

grant trigger on table "public"."kwenta_password_checks" to "anon";

grant truncate on table "public"."kwenta_password_checks" to "anon";

grant update on table "public"."kwenta_password_checks" to "anon";

grant delete on table "public"."kwenta_password_checks" to "authenticated";

grant insert on table "public"."kwenta_password_checks" to "authenticated";

grant references on table "public"."kwenta_password_checks" to "authenticated";

grant select on table "public"."kwenta_password_checks" to "authenticated";

grant trigger on table "public"."kwenta_password_checks" to "authenticated";

grant truncate on table "public"."kwenta_password_checks" to "authenticated";

grant update on table "public"."kwenta_password_checks" to "authenticated";

grant delete on table "public"."kwenta_password_checks" to "service_role";

grant insert on table "public"."kwenta_password_checks" to "service_role";

grant references on table "public"."kwenta_password_checks" to "service_role";

grant select on table "public"."kwenta_password_checks" to "service_role";

grant trigger on table "public"."kwenta_password_checks" to "service_role";

grant truncate on table "public"."kwenta_password_checks" to "service_role";

grant update on table "public"."kwenta_password_checks" to "service_role";

grant delete on table "public"."kwenta_push_subscriptions" to "anon";

grant insert on table "public"."kwenta_push_subscriptions" to "anon";

grant references on table "public"."kwenta_push_subscriptions" to "anon";

grant select on table "public"."kwenta_push_subscriptions" to "anon";

grant trigger on table "public"."kwenta_push_subscriptions" to "anon";

grant truncate on table "public"."kwenta_push_subscriptions" to "anon";

grant update on table "public"."kwenta_push_subscriptions" to "anon";

grant delete on table "public"."kwenta_push_subscriptions" to "authenticated";

grant insert on table "public"."kwenta_push_subscriptions" to "authenticated";

grant references on table "public"."kwenta_push_subscriptions" to "authenticated";

grant select on table "public"."kwenta_push_subscriptions" to "authenticated";

grant trigger on table "public"."kwenta_push_subscriptions" to "authenticated";

grant truncate on table "public"."kwenta_push_subscriptions" to "authenticated";

grant update on table "public"."kwenta_push_subscriptions" to "authenticated";

grant delete on table "public"."kwenta_push_subscriptions" to "service_role";

grant insert on table "public"."kwenta_push_subscriptions" to "service_role";

grant references on table "public"."kwenta_push_subscriptions" to "service_role";

grant select on table "public"."kwenta_push_subscriptions" to "service_role";

grant trigger on table "public"."kwenta_push_subscriptions" to "service_role";

grant truncate on table "public"."kwenta_push_subscriptions" to "service_role";

grant update on table "public"."kwenta_push_subscriptions" to "service_role";

grant delete on table "public"."kwenta_recurring" to "anon";

grant insert on table "public"."kwenta_recurring" to "anon";

grant references on table "public"."kwenta_recurring" to "anon";

grant select on table "public"."kwenta_recurring" to "anon";

grant trigger on table "public"."kwenta_recurring" to "anon";

grant truncate on table "public"."kwenta_recurring" to "anon";

grant update on table "public"."kwenta_recurring" to "anon";

grant delete on table "public"."kwenta_recurring" to "authenticated";

grant insert on table "public"."kwenta_recurring" to "authenticated";

grant references on table "public"."kwenta_recurring" to "authenticated";

grant select on table "public"."kwenta_recurring" to "authenticated";

grant trigger on table "public"."kwenta_recurring" to "authenticated";

grant truncate on table "public"."kwenta_recurring" to "authenticated";

grant update on table "public"."kwenta_recurring" to "authenticated";

grant delete on table "public"."kwenta_recurring" to "service_role";

grant insert on table "public"."kwenta_recurring" to "service_role";

grant references on table "public"."kwenta_recurring" to "service_role";

grant select on table "public"."kwenta_recurring" to "service_role";

grant trigger on table "public"."kwenta_recurring" to "service_role";

grant truncate on table "public"."kwenta_recurring" to "service_role";

grant update on table "public"."kwenta_recurring" to "service_role";

grant delete on table "public"."kwenta_salary" to "anon";

grant insert on table "public"."kwenta_salary" to "anon";

grant references on table "public"."kwenta_salary" to "anon";

grant select on table "public"."kwenta_salary" to "anon";

grant trigger on table "public"."kwenta_salary" to "anon";

grant truncate on table "public"."kwenta_salary" to "anon";

grant update on table "public"."kwenta_salary" to "anon";

grant delete on table "public"."kwenta_salary" to "authenticated";

grant insert on table "public"."kwenta_salary" to "authenticated";

grant references on table "public"."kwenta_salary" to "authenticated";

grant select on table "public"."kwenta_salary" to "authenticated";

grant trigger on table "public"."kwenta_salary" to "authenticated";

grant truncate on table "public"."kwenta_salary" to "authenticated";

grant update on table "public"."kwenta_salary" to "authenticated";

grant delete on table "public"."kwenta_salary" to "service_role";

grant insert on table "public"."kwenta_salary" to "service_role";

grant references on table "public"."kwenta_salary" to "service_role";

grant select on table "public"."kwenta_salary" to "service_role";

grant trigger on table "public"."kwenta_salary" to "service_role";

grant truncate on table "public"."kwenta_salary" to "service_role";

grant update on table "public"."kwenta_salary" to "service_role";

grant delete on table "public"."kwenta_transactions" to "anon";

grant insert on table "public"."kwenta_transactions" to "anon";

grant references on table "public"."kwenta_transactions" to "anon";

grant select on table "public"."kwenta_transactions" to "anon";

grant trigger on table "public"."kwenta_transactions" to "anon";

grant truncate on table "public"."kwenta_transactions" to "anon";

grant update on table "public"."kwenta_transactions" to "anon";

grant delete on table "public"."kwenta_transactions" to "authenticated";

grant insert on table "public"."kwenta_transactions" to "authenticated";

grant references on table "public"."kwenta_transactions" to "authenticated";

grant select on table "public"."kwenta_transactions" to "authenticated";

grant trigger on table "public"."kwenta_transactions" to "authenticated";

grant truncate on table "public"."kwenta_transactions" to "authenticated";

grant update on table "public"."kwenta_transactions" to "authenticated";

grant delete on table "public"."kwenta_transactions" to "service_role";

grant insert on table "public"."kwenta_transactions" to "service_role";

grant references on table "public"."kwenta_transactions" to "service_role";

grant select on table "public"."kwenta_transactions" to "service_role";

grant trigger on table "public"."kwenta_transactions" to "service_role";

grant truncate on table "public"."kwenta_transactions" to "service_role";

grant update on table "public"."kwenta_transactions" to "service_role";


  create policy "Owner or household access to bills"
  on "public"."kwenta_bills"
  as permissive
  for all
  to public
using ((((auth.uid() = user_id) OR public.is_household_member(household_id)) AND public.session_satisfies_mfa()))
with check ((public.session_satisfies_mfa() AND (((household_id IS NULL) AND (auth.uid() = user_id)) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id)))));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_bills"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "users manage their own alert log"
  on "public"."kwenta_budget_alert_log"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Owner or household access to budgets"
  on "public"."kwenta_budgets"
  as permissive
  for all
  to public
using ((((auth.uid() = user_id) OR public.is_household_member(household_id)) AND public.session_satisfies_mfa()))
with check ((public.session_satisfies_mfa() AND (((household_id IS NULL) AND (auth.uid() = user_id)) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id)))));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_budgets"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "custom categories: delete"
  on "public"."kwenta_custom_categories"
  as permissive
  for delete
  to public
using ((((household_id IS NULL) AND (user_id = auth.uid())) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id))));



  create policy "custom categories: insert"
  on "public"."kwenta_custom_categories"
  as permissive
  for insert
  to public
with check (((user_id = auth.uid()) AND ((household_id IS NULL) OR public.is_household_member(household_id))));



  create policy "custom categories: select"
  on "public"."kwenta_custom_categories"
  as permissive
  for select
  to public
using ((((household_id IS NULL) AND (user_id = auth.uid())) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id))));



  create policy "custom categories: update"
  on "public"."kwenta_custom_categories"
  as permissive
  for update
  to public
using ((((household_id IS NULL) AND (user_id = auth.uid())) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id))))
with check (((household_id IS NULL) OR public.is_household_member(household_id)));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_custom_categories"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "Owner or household access to goals"
  on "public"."kwenta_goals"
  as permissive
  for all
  to public
using ((((auth.uid() = user_id) OR public.is_household_member(household_id)) AND public.session_satisfies_mfa()))
with check ((public.session_satisfies_mfa() AND (((household_id IS NULL) AND (auth.uid() = user_id)) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id)))));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_goals"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "household members can view activity"
  on "public"."kwenta_household_activity"
  as permissive
  for select
  to public
using (public.is_household_member(household_id));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_household_activity"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "Members can view their household's roster"
  on "public"."kwenta_household_members"
  as permissive
  for select
  to public
using ((public.is_household_member(household_id) AND public.session_satisfies_mfa()));



  create policy "Users can remove their own membership"
  on "public"."kwenta_household_members"
  as permissive
  for delete
  to public
using (((user_id = auth.uid()) AND public.session_satisfies_mfa()));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_household_members"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "Members can view their household"
  on "public"."kwenta_households"
  as permissive
  for select
  to public
using ((public.is_household_member(id) AND public.session_satisfies_mfa()));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_households"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "Owner or household access to loans"
  on "public"."kwenta_loans"
  as permissive
  for all
  to public
using ((((auth.uid() = user_id) OR public.is_household_member(household_id)) AND public.session_satisfies_mfa()))
with check ((public.session_satisfies_mfa() AND (((household_id IS NULL) AND (auth.uid() = user_id)) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id)))));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_loans"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "delete own push subs"
  on "public"."kwenta_push_subscriptions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "insert own push subs"
  on "public"."kwenta_push_subscriptions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_push_subscriptions"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "select own push subs"
  on "public"."kwenta_push_subscriptions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Owner or household access to recurring"
  on "public"."kwenta_recurring"
  as permissive
  for all
  to public
using ((((auth.uid() = user_id) OR public.is_household_member(household_id)) AND public.session_satisfies_mfa()))
with check ((public.session_satisfies_mfa() AND (((household_id IS NULL) AND (auth.uid() = user_id)) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id)))));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_recurring"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "Users manage their own salary rows"
  on "public"."kwenta_salary"
  as permissive
  for all
  to public
using (((auth.uid() = user_id) AND public.session_satisfies_mfa()))
with check (((auth.uid() = user_id) AND public.session_satisfies_mfa()));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_salary"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));



  create policy "Owner or household access to transactions"
  on "public"."kwenta_transactions"
  as permissive
  for all
  to public
using ((((auth.uid() = user_id) OR public.is_household_member(household_id)) AND public.session_satisfies_mfa()))
with check ((public.session_satisfies_mfa() AND (((household_id IS NULL) AND (auth.uid() = user_id)) OR ((household_id IS NOT NULL) AND public.is_household_member(household_id)))));



  create policy "kwenta_require_mfa"
  on "public"."kwenta_transactions"
  as restrictive
  for all
  to authenticated
using (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok))
with check (( SELECT public.kwenta_mfa_ok() AS kwenta_mfa_ok));


CREATE TRIGGER kwenta_bills_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.kwenta_bills FOR EACH ROW EXECUTE FUNCTION public._kwenta_log_bill_activity();

CREATE TRIGGER kwenta_budgets_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.kwenta_budgets FOR EACH ROW EXECUTE FUNCTION public._kwenta_log_budget_activity();

CREATE TRIGGER kwenta_goals_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.kwenta_goals FOR EACH ROW EXECUTE FUNCTION public._kwenta_log_goal_activity();

CREATE TRIGGER kwenta_loans_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.kwenta_loans FOR EACH ROW EXECUTE FUNCTION public._kwenta_log_loan_activity();

CREATE TRIGGER kwenta_recurring_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.kwenta_recurring FOR EACH ROW EXECUTE FUNCTION public._kwenta_log_recurring_activity();

CREATE TRIGGER budget_alert_trigger AFTER INSERT ON public.kwenta_transactions FOR EACH ROW EXECUTE FUNCTION public.check_budget_alert();

CREATE TRIGGER kwenta_transactions_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.kwenta_transactions FOR EACH ROW EXECUTE FUNCTION public._kwenta_log_transaction_activity();


