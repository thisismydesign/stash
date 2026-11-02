-- Pictures: a board may carry one, as an https link or a file in the private
-- `images` bucket under the owner's folder. A link anyone can fetch; a file is
-- served by signed URL, minted for the owner by their session and for a shared
-- board's readers by the stash function.

alter table public.boards add column image text
  check (image is null or (length(image) <= 2048 and (image like 'https://%' or image like owner::text || '/%')));

grant insert (image) on public.boards to authenticated;
grant update (image) on public.boards to authenticated;

drop trigger boards_touch_updated_at on public.boards;
create trigger boards_touch_updated_at
  before update on public.boards
  for each row
  when (
    row(old.title, old.kind, old.content, old.tags, old.pinned, old.archived_at, old.image)
    is distinct from row(new.title, new.kind, new.content, new.tags, new.pinned, new.archived_at, new.image)
  )
  execute function public.touch_updated_at();

drop function public.shared_board(text);
create function public.shared_board(token text)
returns table (id uuid, title text, kind text, content text, tags text[], image text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select b.id, b.title, b.kind, b.content, b.tags, b.image, b.updated_at
  from public.boards b
  where b.share_token = shared_board.token;
$$;
revoke all on function public.shared_board(text) from public, anon, authenticated;
grant execute on function public.shared_board(text) to anon, authenticated, service_role;

-- SVG stays out: served inline, it would run scripts on the storage origin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 5242880, '{image/png,image/jpeg,image/gif,image/webp,image/avif}');

create policy "owner manages own images" on storage.objects
  for all to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
