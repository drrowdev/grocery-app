-- Phase 11: allow household members to read each other's profiles, and
-- split the /household members query into two simple queries.

-- Add an additional read policy: any profile is visible to other members
-- of any household you share with that user.
drop policy if exists profiles_household_visible on public.profiles;
create policy profiles_household_visible on public.profiles
  for select
  using (
    exists (
      select 1
        from public.household_members mine
        join public.household_members theirs
          on theirs.household_id = mine.household_id
       where mine.user_id = auth.uid()
         and theirs.user_id = public.profiles.id
    )
  );
