-- Phase 12: list types
-- Lists can be 'grocery' (default — auto-categorize, group by category, etc.)
-- or 'general' (plain checklist, no categorization, no grocery-specific UI).

do $$ begin
  create type list_type as enum ('grocery', 'general');
exception when duplicate_object then null; end $$;

alter table public.shopping_lists
  add column if not exists type list_type not null default 'grocery';
