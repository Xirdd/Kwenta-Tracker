-- ══════════════════════════════════════════════════════════════════════════
-- BACKUP / RESTORE — wipe_my_data() clears every data table for the caller,
-- as the first step of a restore (replace everything with the backup).
--
-- Deliberately separate from delete_my_account_data(): that one also
-- removes household membership, which a restore shouldn't touch — someone
-- restoring a backup is still the same household member they were before,
-- just rolling their own contributed data back to an earlier state.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function wipe_my_data()
returns void as $$
begin
  delete from kwenta_salary where user_id = auth.uid();
  delete from kwenta_transactions where user_id = auth.uid();
  delete from kwenta_recurring where user_id = auth.uid();
  delete from kwenta_budgets where user_id = auth.uid();
  delete from kwenta_bills where user_id = auth.uid();
  delete from kwenta_goals where user_id = auth.uid();
  delete from kwenta_loans where user_id = auth.uid();
end;
$$ language plpgsql security definer;

grant execute on function wipe_my_data() to authenticated;