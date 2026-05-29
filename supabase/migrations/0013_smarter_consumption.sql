-- Phase 17: smarter consumption profiles
-- Adds three signals to the recurrence engine:
--   typical_unit       -- modal unit across purchases (so a switch from
--                         pkt to g doesn't break the suggestion shape)
--   typical_weekday    -- dominant day-of-week for purchases (0=Sun..6=Sat),
--                         set only when at least 50% of purchases hit the
--                         same day so weak patterns don't pull predictions
--   daily_rate         -- units consumed per day across the observation
--                         window. Used to estimate when the most recent
--                         purchase will be exhausted.
--   estimated_runout_at -- last_purchased + (last_qty / daily_rate).
--                         next_predicted_date is now the later of the
--                         gap-based prediction and the rate-based runout,
--                         so a big shop pushes the next suggestion out.

alter table public.consumption_profiles
  add column if not exists typical_unit text,
  add column if not exists typical_weekday smallint,
  add column if not exists daily_rate numeric,
  add column if not exists estimated_runout_at timestamptz;

create or replace function public.recompute_consumption(p_item_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  h uuid;
  cnt int;
  avg_q numeric;
  avg_days numeric;
  std_days numeric;
  last_at timestamptz;
  first_at timestamptz;
  last_qty numeric;
  conf numeric;
  is_rec boolean;
  next_at timestamptz;
  modal_unit text;
  modal_weekday smallint;
  weekday_share numeric;
  span_days numeric;
  total_qty numeric;
  rate numeric;
  runout_at timestamptz;
  gap_based_next timestamptz;
  rate_based_next timestamptz;
begin
  select household_id into h from public.items where id = p_item_id;
  if h is null then return; end if;

  select count(*), avg(qty), max(purchased_at), min(purchased_at), sum(qty)
    into cnt, avg_q, last_at, first_at, total_qty
    from public.purchases where item_id = p_item_id;

  if cnt = 0 then
    delete from public.consumption_profiles where item_id = p_item_id;
    return;
  end if;

  -- Modal unit: most common unit across this item's purchases.
  select unit into modal_unit
    from public.purchases
   where item_id = p_item_id
   group by unit
   order by count(*) desc, max(purchased_at) desc
   limit 1;

  -- Latest purchase qty (used for the rate-based runout estimate).
  select qty into last_qty
    from public.purchases
   where item_id = p_item_id
   order by purchased_at desc
   limit 1;

  if cnt < 2 then
    insert into public.consumption_profiles (
      item_id, household_id, sample_count, last_purchased_at, avg_qty,
      typical_unit, updated_at
    )
    values (p_item_id, h, cnt, last_at, avg_q, modal_unit, now())
    on conflict (item_id) do update set
      sample_count = excluded.sample_count,
      last_purchased_at = excluded.last_purchased_at,
      avg_qty = excluded.avg_qty,
      typical_unit = excluded.typical_unit,
      updated_at = now();
    return;
  end if;

  -- Gap statistics.
  with gaps as (
    select extract(epoch from (purchased_at - lag(purchased_at) over (order by purchased_at))) / 86400.0 as g
      from public.purchases where item_id = p_item_id
  )
  select avg(g), coalesce(stddev_samp(g), 0)
    into avg_days, std_days from gaps where g is not null;

  -- Dominant weekday: set only if >= 50% of purchases hit the same day.
  with weekdays as (
    select extract(dow from purchased_at)::smallint as d
      from public.purchases where item_id = p_item_id
  ), counts as (
    select d, count(*)::numeric as c, sum(count(*)) over () as total
      from weekdays group by d
  )
  select d, c / total into modal_weekday, weekday_share
    from counts order by c desc limit 1;
  if weekday_share is null or weekday_share < 0.5 then
    modal_weekday := null;
  end if;

  -- Daily consumption rate: total qty / observed days.
  span_days := greatest(1, extract(epoch from (last_at - first_at)) / 86400.0);
  rate := total_qty / span_days;

  -- Runout: when the LAST purchase will be exhausted at the learned rate.
  if rate > 0 then
    runout_at := last_at + ((coalesce(last_qty, avg_q) / rate) || ' days')::interval;
  else
    runout_at := null;
  end if;

  -- Gap-based prediction (unchanged from before).
  gap_based_next := case when avg_days > 0 then last_at + (avg_days || ' days')::interval else null end;
  rate_based_next := runout_at;

  -- Take the later of the two: a single big shop pushes the next prediction
  -- further out, but a fast cadence still wins when rate is generous.
  if gap_based_next is null then
    next_at := rate_based_next;
  elsif rate_based_next is null then
    next_at := gap_based_next;
  else
    next_at := greatest(gap_based_next, rate_based_next);
  end if;

  -- Snap to dominant weekday: nudge next_at forward (up to 6 days) so it
  -- lands on the user's usual shopping day for this item.
  if modal_weekday is not null and next_at is not null then
    while extract(dow from next_at)::smallint <> modal_weekday loop
      next_at := next_at + interval '1 day';
    end loop;
  end if;

  conf := least(1.0, cnt::numeric / 6.0)
          * (1.0 - least(1.0, coalesce(std_days / nullif(avg_days, 0), 1)));
  is_rec := (cnt >= 3 and conf >= 0.5);

  insert into public.consumption_profiles (
    item_id, household_id, avg_qty, avg_cycle_days, stdev_days, sample_count,
    is_recurring, confidence, last_purchased_at, next_predicted_date,
    typical_unit, typical_weekday, daily_rate, estimated_runout_at,
    updated_at
  ) values (
    p_item_id, h, avg_q, avg_days, std_days, cnt, is_rec, conf, last_at, next_at,
    modal_unit, modal_weekday, rate, runout_at,
    now()
  )
  on conflict (item_id) do update set
    avg_qty = excluded.avg_qty,
    avg_cycle_days = excluded.avg_cycle_days,
    stdev_days = excluded.stdev_days,
    sample_count = excluded.sample_count,
    is_recurring = excluded.is_recurring,
    confidence = excluded.confidence,
    last_purchased_at = excluded.last_purchased_at,
    next_predicted_date = excluded.next_predicted_date,
    typical_unit = excluded.typical_unit,
    typical_weekday = excluded.typical_weekday,
    daily_rate = excluded.daily_rate,
    estimated_runout_at = excluded.estimated_runout_at,
    updated_at = now();
end;
$$;

grant execute on function public.recompute_consumption(uuid) to authenticated;

-- Recompute every existing profile once so the new columns get populated.
do $$
declare
  it uuid;
begin
  for it in select item_id from public.consumption_profiles loop
    perform public.recompute_consumption(it);
  end loop;
end $$;
