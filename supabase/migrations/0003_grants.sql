-- Phase 4 fix: grant table privileges to authenticated role.
-- The project was created with "Automatically expose new tables" disabled,
-- so the authenticated role has no privileges until we explicitly grant them.
-- RLS still controls *which rows* each user can access.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Future tables added in later migrations should also be granted automatically:
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Helper functions need execute permission
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
