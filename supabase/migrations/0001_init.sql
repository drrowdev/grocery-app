-- Ostoslista — initial schema
-- Apply via Supabase SQL Editor (or `supabase db push` if using CLI).

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Enums --------------------------------------------------------------------
do $$ begin
  create type unit_kind as enum ('kpl','kg','g','l','dl','ml','pkt');
exception when duplicate_object then null; end $$;

do $$ begin
  create type list_status as enum ('active','completed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('owner','member');
exception when duplicate_object then null; end $$;

-- Profiles (1-1 with auth.users) -------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  ui_lang text not null default 'fi' check (ui_lang in ('fi','sv')),
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Households ---------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists idx_household_members_user on public.household_members(user_id);

-- Helper: is the current auth.uid() a member of a given household?
create or replace function public.is_household_member(h uuid) returns boolean as $$
  select exists (
    select 1 from public.household_members
    where household_id = h and user_id = auth.uid()
  );
$$ language sql stable security definer;

-- When a household is created, add creator as owner
create or replace function public.handle_new_household() returns trigger as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_household_created on public.households;
create trigger on_household_created
  after insert on public.households for each row execute function public.handle_new_household();

-- Categories (global, read-only for users) ---------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_fi text not null,
  name_sv text not null,
  icon text,
  sort_order int not null default 0
);

-- Items + aliases ----------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  canonical_fi text not null,
  canonical_sv text not null,
  category_id uuid references public.categories(id) on delete set null,
  unit unit_kind not null default 'kpl',
  default_qty numeric not null default 1,
  created_at timestamptz not null default now(),
  unique (household_id, canonical_fi)
);

create index if not exists idx_items_household on public.items(household_id);
create index if not exists idx_items_canonical_fi_trgm on public.items using gin (canonical_fi gin_trgm_ops);
create index if not exists idx_items_canonical_sv_trgm on public.items using gin (canonical_sv gin_trgm_ops);

create table if not exists public.item_aliases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  alias text not null,
  lang text not null check (lang in ('fi','sv')),
  unique (item_id, alias, lang)
);

create index if not exists idx_aliases_item on public.item_aliases(item_id);
create index if not exists idx_aliases_alias_trgm on public.item_aliases using gin (alias gin_trgm_ops);

-- Stores + per-store aisle order ------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table if not exists public.store_aisle_order (
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  sort_order int not null default 0,
  primary key (store_id, category_id)
);

-- Lists --------------------------------------------------------------------
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Ostoslista',
  status list_status not null default 'active',
  store_id uuid references public.stores(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_lists_household_active on public.shopping_lists(household_id) where status = 'active';

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  qty numeric not null default 1,
  unit unit_kind not null default 'kpl',
  checked boolean not null default false,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  checked_at timestamptz,
  unique (list_id, item_id)
);

create index if not exists idx_list_items_list on public.list_items(list_id);

-- Purchases (immutable history) -------------------------------------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  qty numeric not null,
  unit unit_kind not null,
  purchased_at timestamptz not null default now(),
  list_id uuid references public.shopping_lists(id) on delete set null
);

create index if not exists idx_purchases_item_time on public.purchases(item_id, purchased_at desc);
create index if not exists idx_purchases_household_time on public.purchases(household_id, purchased_at desc);

-- Consumption profiles (learning output) ----------------------------------
create table if not exists public.consumption_profiles (
  item_id uuid primary key references public.items(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  avg_qty numeric,
  avg_cycle_days numeric,
  stdev_days numeric,
  sample_count int not null default 0,
  is_recurring boolean not null default false,
  confidence numeric not null default 0,
  last_purchased_at timestamptz,
  next_predicted_date timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_consumption_household_recurring on public.consumption_profiles(household_id) where is_recurring;

-- Pantry -------------------------------------------------------------------
create table if not exists public.pantry (
  item_id uuid primary key references public.items(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  qty_on_hand numeric not null default 0,
  unit unit_kind not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security --------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.households             enable row level security;
alter table public.household_members      enable row level security;
alter table public.categories             enable row level security;
alter table public.items                  enable row level security;
alter table public.item_aliases           enable row level security;
alter table public.stores                 enable row level security;
alter table public.store_aisle_order      enable row level security;
alter table public.shopping_lists         enable row level security;
alter table public.list_items             enable row level security;
alter table public.purchases              enable row level security;
alter table public.consumption_profiles   enable row level security;
alter table public.pantry                 enable row level security;

-- profiles: own row only
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- households: members can read, creator can insert, owners can update/delete
drop policy if exists households_read on public.households;
create policy households_read on public.households
  for select using (public.is_household_member(id));

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert with check (created_by = auth.uid());

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update using (
    exists (select 1 from public.household_members hm
            where hm.household_id = households.id
              and hm.user_id = auth.uid()
              and hm.role = 'owner')
  );

-- household_members: members can read; owners (or self via invite flow) can write
drop policy if exists members_read on public.household_members;
create policy members_read on public.household_members
  for select using (public.is_household_member(household_id));

drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members
  for insert with check (
    -- allow self-join (invite-acceptance flow) or owner-add
    user_id = auth.uid() or exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

drop policy if exists members_delete on public.household_members;
create policy members_delete on public.household_members
  for delete using (
    user_id = auth.uid() or exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- categories: read for all authenticated; writes restricted (none)
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select using (auth.role() = 'authenticated');

-- Household-scoped tables: full CRUD for members
do $$
declare
  tbl text;
  household_tables text[] := array[
    'items','stores','shopping_lists','purchases','consumption_profiles','pantry'
  ];
begin
  foreach tbl in array household_tables loop
    execute format('drop policy if exists %I_all on public.%I', tbl, tbl);
    execute format(
      'create policy %I_all on public.%I for all
       using (public.is_household_member(household_id))
       with check (public.is_household_member(household_id))',
      tbl, tbl);
  end loop;
end $$;

-- item_aliases: access via parent item's household
drop policy if exists aliases_all on public.item_aliases;
create policy aliases_all on public.item_aliases
  for all using (
    exists (select 1 from public.items i
            where i.id = item_aliases.item_id
              and public.is_household_member(i.household_id))
  ) with check (
    exists (select 1 from public.items i
            where i.id = item_aliases.item_id
              and public.is_household_member(i.household_id))
  );

-- list_items: access via parent list's household
drop policy if exists list_items_all on public.list_items;
create policy list_items_all on public.list_items
  for all using (
    exists (select 1 from public.shopping_lists sl
            where sl.id = list_items.list_id
              and public.is_household_member(sl.household_id))
  ) with check (
    exists (select 1 from public.shopping_lists sl
            where sl.id = list_items.list_id
              and public.is_household_member(sl.household_id))
  );

-- store_aisle_order: access via store's household
drop policy if exists aisle_all on public.store_aisle_order;
create policy aisle_all on public.store_aisle_order
  for all using (
    exists (select 1 from public.stores s
            where s.id = store_aisle_order.store_id
              and public.is_household_member(s.household_id))
  ) with check (
    exists (select 1 from public.stores s
            where s.id = store_aisle_order.store_id
              and public.is_household_member(s.household_id))
  );

-- Realtime ------------------------------------------------------------------
-- Enable realtime broadcasts on the tables we subscribe to from the client.
alter publication supabase_realtime add table public.shopping_lists;
alter publication supabase_realtime add table public.list_items;

-- Seed categories ----------------------------------------------------------
insert into public.categories (key, name_fi, name_sv, icon, sort_order) values
  ('produce',     'Hedelmät & vihannekset', 'Frukt & grönt',         '🥕', 10),
  ('meat',        'Liha',                    'Kött',                  '🥩', 20),
  ('fish',        'Kala',                    'Fisk',                  '🐟', 30),
  ('dairy',       'Maitotuotteet',           'Mejeriprodukter',       '🥛', 40),
  ('bakery',      'Leipä & leivonnaiset',    'Bröd & bageri',         '🍞', 50),
  ('frozen',      'Pakasteet',               'Fryst',                 '🧊', 60),
  ('dry_goods',   'Kuivatuotteet',           'Torrvaror',             '🌾', 70),
  ('canned',      'Säilykkeet',              'Konserver',             '🥫', 80),
  ('spices',      'Mausteet',                'Kryddor',               '🧂', 90),
  ('drinks',      'Juomat',                  'Drycker',               '🥤', 100),
  ('snacks',      'Makeiset & napostelu',    'Godis & snacks',        '🍫', 110),
  ('household',   'Kodin tarvikkeet',        'Hushållsartiklar',      '🧻', 120),
  ('hygiene',     'Hygienia',                'Hygien',                '🧼', 130),
  ('other',       'Muut',                    'Övrigt',                '📦', 999)
on conflict (key) do update set
  name_fi = excluded.name_fi,
  name_sv = excluded.name_sv,
  icon = excluded.icon,
  sort_order = excluded.sort_order;
