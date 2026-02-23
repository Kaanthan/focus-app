-- Fix "Database Error Deleting User"
-- This error happens because the 'profiles' table references 'auth.users' but blocks deletion.
-- We need to change the constraint to "CASCADE" so deleting a User also deletes their Profile.

-- 1. Drop the old strict constraint (if it exists)
alter table public.profiles
drop constraint if exists profiles_id_fkey;

-- 2. Add the new constraint with ON DELETE CASCADE
alter table public.profiles
add constraint profiles_id_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade;

-- 3. Ensure the delete function is correct
create or replace function delete_user_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users
  where id = auth.uid();
end;
$$;
