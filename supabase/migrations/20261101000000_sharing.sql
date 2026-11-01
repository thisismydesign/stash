-- Sharing: a board with a share token can be read by anyone who presents the
-- token. The database mints the token, so no caller can pick a weak one, and
-- nothing lists shared boards: a reader must already have the link.

alter table public.boards add column share_token text unique;

-- The token column is written only through share_board and unshare_board.
revoke insert, update on public.boards from authenticated;
grant insert (title, kind, content, tags, pinned, archived_at) on public.boards to authenticated;
grant update (title, kind, content, tags, pinned, archived_at) on public.boards to authenticated;

-- Sharing is not an edit: updated_at follows what the board says.
drop trigger boards_touch_updated_at on public.boards;
create trigger boards_touch_updated_at
  before update on public.boards
  for each row
  when (
    row(old.title, old.kind, old.content, old.tags, old.pinned, old.archived_at)
    is distinct from row(new.title, new.kind, new.content, new.tags, new.pinned, new.archived_at)
  )
  execute function public.touch_updated_at();

-- A UUID's 122 random bits, as 32 hex characters.
create function public.share_board(board_id uuid)
returns setof public.boards
language sql
security definer
set search_path = ''
rows 1
as $$
  update public.boards b
  set share_token = coalesce(b.share_token, replace(gen_random_uuid()::text, '-', ''))
  where b.id = board_id and b.owner = auth.uid()
  returning b.*;
$$;

create function public.unshare_board(board_id uuid)
returns setof public.boards
language sql
security definer
set search_path = ''
rows 1
as $$
  update public.boards b
  set share_token = null
  where b.id = board_id and b.owner = auth.uid()
  returning b.*;
$$;

create function public.shared_board(token text)
returns table (id uuid, title text, kind text, content text, tags text[], updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select b.id, b.title, b.kind, b.content, b.tags, b.updated_at
  from public.boards b
  where b.share_token = shared_board.token;
$$;

revoke all on function public.share_board(uuid), public.unshare_board(uuid), public.shared_board(text)
  from public, anon, authenticated;
grant execute on function public.share_board(uuid), public.unshare_board(uuid)
  to authenticated, service_role;
grant execute on function public.shared_board(text) to anon, authenticated, service_role;
