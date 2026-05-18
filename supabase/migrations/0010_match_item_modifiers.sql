-- Phase 14: match_item must respect modifier tokens
-- '10% malet kött' and '17% malet kött' are similar enough by trigram
-- distance that the previous fuzzy match collapsed them onto the same
-- item. That's wrong — modifiers like fat percentage, 'luomu', 'rasvaton'
-- are part of item identity. This version extracts these tokens from
-- both sides and refuses to match if they differ.

create or replace function public.match_item(p_household uuid, p_text text)
returns uuid
language plpgsql stable
as $$
declare
  q text := lower(trim(p_text));
  q_pct text[];
  q_mods text[];
  found uuid;
  cand_text text;
  cand_pct text[];
  cand_mods text[];
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

  -- 3. Trigram fuzzy match, but only when modifier tokens agree.
  -- Extract percentage modifiers ("10%", "1.5%") and known qualifier
  -- keywords from the query. We then iterate candidates above the
  -- similarity threshold and pick the first whose modifier sets match.
  q_pct := array(select (regexp_matches(q, '(\d+[.,]?\d*)\s*%', 'g'))[1]);
  q_mods := array(
    select m from unnest(string_to_array(q, ' ')) m
     where m in ('luomu','eko','ekologisk','organic','rasvaton','kevyt',
                 'fettfri','lätt','mager','tuore','pakaste','fryst')
  );

  for found, cand_text in
    select i.id, lower(coalesce(i.canonical_fi, '')) || ' / ' || lower(coalesce(i.canonical_sv, ''))
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
     limit 8
  loop
    cand_pct := array(select (regexp_matches(cand_text, '(\d+[.,]?\d*)\s*%', 'g'))[1]);
    cand_mods := array(
      select m from unnest(string_to_array(cand_text, ' ')) m
       where m in ('luomu','eko','ekologisk','organic','rasvaton','kevyt',
                   'fettfri','lätt','mager','tuore','pakaste','fryst')
    );
    -- Treat as match only when both modifier sets are identical (order-independent).
    if (q_pct <@ cand_pct and q_pct @> cand_pct)
       and (q_mods <@ cand_mods and q_mods @> cand_mods) then
      return found;
    end if;
  end loop;

  return null;
end;
$$;

grant execute on function public.match_item(uuid, text) to authenticated;
