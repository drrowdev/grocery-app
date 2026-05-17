-- Phase 8: recurrence engine
-- After a purchase, recompute the item's consumption profile and flag it
-- as "recurring" once we have enough confidence.

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
  conf numeric;
  is_rec boolean;
  next_at timestamptz;
begin
  select household_id into h from public.items where id = p_item_id;
  if h is null then return; end if;

  select count(*), avg(qty), max(purchased_at)
    into cnt, avg_q, last_at
    from public.purchases where item_id = p_item_id;

  if cnt < 2 then
    insert into public.consumption_profiles (item_id, household_id, sample_count, last_purchased_at, avg_qty, updated_at)
    values (p_item_id, h, cnt, last_at, avg_q, now())
    on conflict (item_id) do update set
      sample_count = excluded.sample_count,
      last_purchased_at = excluded.last_purchased_at,
      avg_qty = excluded.avg_qty,
      updated_at = now();
    return;
  end if;

  with gaps as (
    select extract(epoch from (purchased_at - lag(purchased_at) over (order by purchased_at))) / 86400.0 as g
    from public.purchases where item_id = p_item_id
  )
  select avg(g), coalesce(stddev_samp(g), 0)
    into avg_days, std_days from gaps where g is not null;

  -- Confidence grows with sample count and shrinks with high variance.
  conf := least(1.0, cnt::numeric / 6.0)
          * (1.0 - least(1.0, coalesce(std_days / nullif(avg_days, 0), 1)));
  is_rec := (cnt >= 3 and conf >= 0.5);
  next_at := case when avg_days > 0 then last_at + (avg_days || ' days')::interval else null end;

  insert into public.consumption_profiles (
    item_id, household_id, avg_qty, avg_cycle_days, stdev_days, sample_count,
    is_recurring, confidence, last_purchased_at, next_predicted_date, updated_at
  ) values (
    p_item_id, h, avg_q, avg_days, std_days, cnt, is_rec, conf, last_at, next_at, now()
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
    updated_at = now();
end;
$$;

create or replace function public.handle_new_purchase()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.recompute_consumption(new.item_id);
  return new;
end; $$;

drop trigger if exists on_purchase_created on public.purchases;
create trigger on_purchase_created
  after insert on public.purchases for each row execute function public.handle_new_purchase();

grant execute on function public.recompute_consumption(uuid) to authenticated;
