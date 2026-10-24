-- Follow-ups from Supabase's security advisor (run after 20261012's pass).
--
--   1. Pin search_path on the two invite-code helpers (advisor:
--      function_search_path_mutable). They are already locked away from every
--      API role by migration 20261012, so this is belt-and-braces.
--   2. The four helpers that row-level-security policies call were still
--      executable by logged-OUT visitors (anon). They return nothing useful to
--      an anonymous caller, but there is no reason to expose them: policies run
--      as the caller, so `authenticated` keeps EXECUTE and everything the app
--      does is unchanged.
--
-- Not changed on purpose: the "SECURITY DEFINER executable by authenticated"
-- warnings are the app's own actions (create/join household, restore, delete
-- account, ...). Each checks auth.uid() and 2FA inside.
--
-- Idempotent and defensive: each function is looked up first, so a renamed or
-- missing one is skipped instead of failing the whole migration.

do $$
declare sig text;
begin
  foreach sig in array array[
    'public.kwenta_new_invite_code()',
    'public.generate_invite_code()'
  ] loop
    if to_regprocedure(sig) is not null then
      execute format('alter function %s set search_path = public', sig);
    end if;
  end loop;

  foreach sig in array array[
    'public.has_verified_mfa()',
    'public.is_household_member(uuid)',
    'public.session_satisfies_mfa()',
    'public.kwenta_mfa_ok()'
  ] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke execute on function %s from public, anon', sig);
      execute format('grant execute on function %s to authenticated, service_role', sig);
    end if;
  end loop;
end $$;