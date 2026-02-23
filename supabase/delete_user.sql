-- FUNCTION: delete_user_account
-- DESCRIPTION: Allows a logged-in user to delete their own account from auth.users.
-- SECURITY: accurate RLS must be reinforced, but this function strictly deletes the executing user.

create or replace function delete_user_account()
returns void
language plpgsql
security definer
as $$
begin
  -- Delete the user from the auth.users table
  -- The cascade effect should handle related data if foreign keys are set up correctly with ON DELETE CASCADE
  delete from auth.users
  where id = auth.uid();
end;
$$;
