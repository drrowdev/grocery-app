-- Phase 4.5: Household invitations
-- Owners can invite people by email. On the invitee's next sign-in (or
-- next /-page render) we auto-add them as a member.

create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (household_id, email)
);

create index if not exists idx_invites_email on public.household_invitations(lower(email))
  where accepted_at is null;

alter table public.household_invitations enable row level security;

-- Members of the household can read its invitations
drop policy if exists invites_member_read on public.household_invitations;
create policy invites_member_read on public.household_invitations
  for select using (public.is_household_member(household_id));

-- Invitee can read their own pending invitations (so the home page can auto-accept)
drop policy if exists invites_self_read on public.household_invitations;
create policy invites_self_read on public.household_invitations
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Owners insert invitations
drop policy if exists invites_owner_insert on public.household_invitations;
create policy invites_owner_insert on public.household_invitations
  for insert with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_invitations.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- Owners delete (revoke) invitations
drop policy if exists invites_owner_delete on public.household_invitations;
create policy invites_owner_delete on public.household_invitations
  for delete using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_invitations.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- Invitee can mark their own invite accepted
drop policy if exists invites_self_update on public.household_invitations;
create policy invites_self_update on public.household_invitations
  for update using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

-- Tighten members_insert: a user may self-join ONLY if they have a pending invite.
drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members
  for insert with check (
    (
      user_id = auth.uid()
      and exists (
        select 1 from public.household_invitations inv
        where inv.household_id = household_members.household_id
          and lower(inv.email) = lower(auth.jwt() ->> 'email')
          and inv.accepted_at is null
      )
    )
    or exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- A bulk-accept helper run by the home page on every render.
create or replace function public.accept_pending_invitations()
returns int
language plpgsql
security definer
as $$
declare
  v_email text;
  v_user uuid;
  v_count int := 0;
  inv record;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_user := auth.uid();
  if v_user is null or v_email = '' then return 0; end if;

  for inv in
    select id, household_id
      from public.household_invitations
     where lower(email) = v_email
       and accepted_at is null
  loop
    insert into public.household_members (household_id, user_id, role)
    values (inv.household_id, v_user, 'member')
    on conflict do nothing;
    update public.household_invitations
       set accepted_at = now()
     where id = inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.accept_pending_invitations() to authenticated;
grant select, insert, update, delete on public.household_invitations to authenticated;
