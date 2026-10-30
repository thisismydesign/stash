-- Boards: the owner's notes, lists and pages, one text each, written in the
-- app or by their agent through PostgREST. Agent keys and the throttle follow,
-- so a cold agent can exchange a key for a session at the stash function.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (length(title) between 1 and 200),
  kind text not null check (kind in ('todo', 'markdown', 'html')),
  content text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_owner_updated_at on public.boards (owner, updated_at desc);
alter table public.boards enable row level security;
create policy "owner manages boards" on public.boards
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create trigger boards_touch_updated_at
  before update on public.boards
  for each row execute function public.touch_updated_at();

-- Agent keys: the durable credential a cold agent exchanges for a session at
-- POST /token. The browser creates a key (random, hashed client-side, shown
-- once) and can revoke it; the function reads hashes and stamps last use.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.api_keys enable row level security;
create policy "owner sees keys" on public.api_keys
  for select to authenticated using (owner = auth.uid());
create policy "owner adds keys" on public.api_keys
  for insert to authenticated with check (owner = auth.uid());
create policy "owner revokes keys" on public.api_keys
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner deletes keys" on public.api_keys
  for delete to authenticated using (owner = auth.uid());

-- One throttle for every public route of the function; a caller is an address or a user id. Service role only.
create table public.throttle (
  id bigint generated always as identity primary key,
  caller text not null,
  route text not null,
  at timestamptz not null default now()
);
create index throttle_caller_route_at on public.throttle (caller, route, at desc);
alter table public.throttle enable row level security;

-- Table privileges spelled out: a local database grants nothing, and without
-- these the API cannot reach any table. Row security does the isolation.
grant select, insert, update, delete on public.boards to authenticated;
-- An agent key's hash is written once; a session may only rename or revoke.
grant select, insert, delete on public.api_keys to authenticated;
grant update (name, revoked_at) on public.api_keys to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
