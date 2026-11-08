-- A board may say what it is for: a line or two of Markdown under its title.

alter table public.boards add column description text not null default ''
  check (length(description) <= 5000);

grant insert (description) on public.boards to authenticated;
grant update (description) on public.boards to authenticated;

drop trigger boards_touch_updated_at on public.boards;
create trigger boards_touch_updated_at
  before update on public.boards
  for each row
  when (
    row(old.title, old.kind, old.content, old.description, old.columns, old.tags, old.pinned, old.archived_at, old.image)
    is distinct from row(new.title, new.kind, new.content, new.description, new.columns, new.tags, new.pinned, new.archived_at, new.image)
  )
  execute function public.touch_updated_at();

drop function public.shared_board(text);
create function public.shared_board(token text)
returns table (id uuid, title text, kind text, content text, description text, columns jsonb, tags text[], image text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select b.id, b.title, b.kind, b.content, b.description, b.columns, b.tags, b.image, b.updated_at
  from public.boards b
  where b.share_token = shared_board.token;
$$;
revoke all on function public.shared_board(text) from public, anon, authenticated;
grant execute on function public.shared_board(text) to anon, authenticated, service_role;
