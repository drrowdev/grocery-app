-- Phase 16: include full row in DELETE replication events
--
-- Supabase realtime DELETE events default to sending only the primary key.
-- That means client-side filters like `list_id=eq.X` can never match — the
-- event is dropped silently. Setting REPLICA IDENTITY FULL makes Postgres
-- include the full row in DELETE payloads, so the filter matches and
-- subscribed clients receive the event.
--
-- Cost: replication payload grows for DELETEs. For our row sizes this is
-- negligible (< 1 KB per event).

alter table public.list_items replica identity full;
alter table public.shopping_lists replica identity full;
alter table public.items replica identity full;
