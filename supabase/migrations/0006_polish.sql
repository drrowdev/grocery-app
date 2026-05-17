-- Phase 10: polish — notes per list item + history view (uses existing shopping_lists table)
alter table public.list_items add column if not exists note text;
