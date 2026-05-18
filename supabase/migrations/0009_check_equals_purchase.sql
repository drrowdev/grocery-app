-- Phase 13: tie check/uncheck to purchase logging
-- list_items.purchase_id links to the purchase row that was created
-- when the item was checked. Unchecking deletes that purchase.

alter table public.list_items
  add column if not exists purchase_id uuid references public.purchases(id) on delete set null;

create index if not exists idx_list_items_purchase on public.list_items(purchase_id)
  where purchase_id is not null;

-- Recompute consumption when a purchase is deleted (e.g. after an uncheck)
create or replace function public.handle_purchase_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.recompute_consumption(old.item_id);
  return old;
end; $$;

drop trigger if exists on_purchase_deleted on public.purchases;
create trigger on_purchase_deleted
  after delete on public.purchases for each row execute function public.handle_purchase_delete();
