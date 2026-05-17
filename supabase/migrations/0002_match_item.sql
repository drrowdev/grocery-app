-- Phase 5: item matching helper

create or replace function public.match_item(p_household uuid, p_text text)
returns uuid
language plpgsql stable
as $$
declare
  q text := lower(trim(p_text));
  found uuid;
begin
  if length(q) = 0 then return null; end if;

  -- 1. Exact alias match (case-insensitive)
  select a.item_id into found
    from public.item_aliases a
    join public.items i on i.id = a.item_id
   where i.household_id = p_household
     and lower(a.alias) = q
   limit 1;
  if found is not null then return found; end if;

  -- 2. Exact canonical match
  select i.id into found
    from public.items i
   where i.household_id = p_household
     and (lower(i.canonical_fi) = q or lower(i.canonical_sv) = q)
   limit 1;
  if found is not null then return found; end if;

  -- 3. Trigram fuzzy match on canonical names (threshold 0.6)
  select i.id into found
    from public.items i
   where i.household_id = p_household
     and greatest(
           similarity(lower(i.canonical_fi), q),
           similarity(lower(i.canonical_sv), q)
         ) > 0.6
   order by greatest(
           similarity(lower(i.canonical_fi), q),
           similarity(lower(i.canonical_sv), q)
         ) desc
   limit 1;
  return found;
end;
$$;

grant execute on function public.match_item(uuid, text) to authenticated;
