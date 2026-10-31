-- Supabase's hosted and self-hosted databases give anon and authenticated every
-- privilege on new public tables by default; the local stack gives none. Make
-- them agree: a role has only what a migration grants it.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, delete on public.api_keys to authenticated;
grant update (name, revoked_at) on public.api_keys to authenticated;
