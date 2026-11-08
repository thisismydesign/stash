-- Tables: a board of typed columns whose rows are rows of their own, so an
-- agent files one entry with one request and two writers never overwrite each
-- other. `columns` says what a row's `data` holds, and the database checks
-- every cell against it, whoever writes. shared/tables.ts and the agent
-- instructions describe the shape, and MUST agree.

alter table public.boards drop constraint boards_kind_check;
alter table public.boards add constraint boards_kind_check
  check (kind in ('todo', 'markdown', 'html', 'table'));

create function public.valid_columns(columns jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(columns) = 'array'
    and jsonb_array_length(columns) <= 100
    and not exists (
      select 1 from jsonb_array_elements(columns) c
      where jsonb_typeof(c) <> 'object'
        or coalesce(c->>'key', '') !~ '^[a-z0-9_]{1,64}$'
        or jsonb_typeof(c->'name') is distinct from 'string'
        or length(c->>'name') not between 1 and 100
        or coalesce(c->>'type', '') not in ('text', 'number', 'date', 'checkbox', 'select', 'url')
        or (c ? 'options' and (
          jsonb_typeof(c->'options') <> 'array'
          or exists (select 1 from jsonb_array_elements(c->'options') o where jsonb_typeof(o) <> 'string')
        ))
        or (c ? 'decimals' and (
          jsonb_typeof(c->'decimals') <> 'number'
          or (c->>'decimals')::numeric not in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
        ))
        or exists (select 1 from jsonb_object_keys(c) k where k not in ('key', 'name', 'type', 'options', 'decimals'))
    )
    and (select count(*) = count(distinct c->>'key') from jsonb_array_elements(columns) c);
$$;

alter table public.boards add column columns jsonb not null default '[]'
  check (public.valid_columns(columns) and (kind = 'table' or columns = '[]'));

grant insert (columns) on public.boards to authenticated;
grant update (columns) on public.boards to authenticated;

drop trigger boards_touch_updated_at on public.boards;
create trigger boards_touch_updated_at
  before update on public.boards
  for each row
  when (
    row(old.title, old.kind, old.content, old.columns, old.tags, old.pinned, old.archived_at, old.image)
    is distinct from row(new.title, new.kind, new.content, new.columns, new.tags, new.pinned, new.archived_at, new.image)
  )
  execute function public.touch_updated_at();

create table public.rows (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rows_board_created_at on public.rows (board_id, created_at);
alter table public.rows enable row level security;
-- A row joins only its owner's own table: a shared table shows every row on it.
create policy "owner manages rows" on public.rows
  for all to authenticated
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and exists (
      select 1 from public.boards b
      where b.id = board_id and b.owner = auth.uid() and b.kind = 'table'
    )
  );
create trigger rows_touch_updated_at
  before update on public.rows
  for each row execute function public.touch_updated_at();

grant select, delete on public.rows to authenticated;
grant insert (board_id, data) on public.rows to authenticated;
grant update (data) on public.rows to authenticated;
grant all on public.rows to service_role;

-- Why a row's data is wrong for its columns, or null when it is right. A cell
-- that is JSON null is empty; a key with no column is a mistake.
create function public.cell_error(columns jsonb, data jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  c jsonb;
  v jsonb;
  s text;
begin
  if jsonb_typeof(data) <> 'object' then return 'A row''s data must be an object.'; end if;
  for k in select jsonb_object_keys(data) loop
    if not exists (select 1 from jsonb_array_elements(columns) e where e->>'key' = k) then
      return format('No column has the key "%s".', k);
    end if;
  end loop;
  for c in select * from jsonb_array_elements(columns) loop
    v := data -> (c->>'key');
    if v is null or jsonb_typeof(v) = 'null' then continue; end if;
    s := v #>> '{}';
    case c->>'type'
      when 'number' then
        if jsonb_typeof(v) <> 'number' then return format('%s: %s is not a number.', c->>'name', v); end if;
      when 'checkbox' then
        if jsonb_typeof(v) <> 'boolean' then return format('%s: %s is not true or false.', c->>'name', v); end if;
      when 'date' then
        if jsonb_typeof(v) <> 'string' or s !~ '^\d{4}-\d{2}-\d{2}$' then
          return format('%s: %s is not a date as YYYY-MM-DD.', c->>'name', v);
        end if;
        begin
          perform s::date;
        exception when others then
          return format('%s: %s is not a date.', c->>'name', v);
        end;
      when 'url' then
        if jsonb_typeof(v) <> 'string' or s !~* '^https?://' then
          return format('%s: %s is not a link starting with https://.', c->>'name', v);
        end if;
      when 'select' then
        if jsonb_typeof(v) <> 'string' or not coalesce(c->'options', '[]') ? s then
          return format('%s: %s is not one of its choices.', c->>'name', v);
        end if;
      else
        if jsonb_typeof(v) <> 'string' then return format('%s: %s is not text.', c->>'name', v); end if;
    end case;
  end loop;
  return null;
end;
$$;

create function public.check_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  problem text;
begin
  select public.cell_error(b.columns, new.data) into problem from public.boards b where b.id = new.board_id;
  if problem is not null then raise exception using message = problem, errcode = 'check_violation'; end if;
  return new;
end;
$$;
create trigger rows_check
  before insert or update of data on public.rows
  for each row execute function public.check_row();

-- Changing the columns: a dropped column takes its cells with it; a changed
-- type must fit what the rows already hold.
create function public.check_columns_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  dropped text[];
  problem text;
begin
  select coalesce(array_agg(o->>'key'), '{}') into dropped
  from jsonb_array_elements(old.columns) o
  where not exists (select 1 from jsonb_array_elements(new.columns) n where n->>'key' = o->>'key');
  if cardinality(dropped) > 0 then
    update public.rows set data = data - dropped where board_id = new.id and data ?| dropped;
  end if;
  select public.cell_error(new.columns, r.data) into problem
  from public.rows r
  where r.board_id = new.id and public.cell_error(new.columns, r.data) is not null
  limit 1;
  if problem is not null then
    raise exception using message = format('A row does not fit the new columns. %s', problem), errcode = 'check_violation';
  end if;
  return null;
end;
$$;
-- After, not before: the rows' own trigger touches this board, which a before trigger's tuple cannot take.
create trigger boards_check_columns_change
  after update of columns on public.boards
  for each row
  when (old.columns is distinct from new.columns)
  execute function public.check_columns_change();

-- A row's change is the table's change; once per statement, however many rows.
-- Definer: a session may not write updated_at itself.
create function public.touch_board()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.boards b set updated_at = now()
  where b.id in (select board_id from changed_rows);
  return null;
end;
$$;
create trigger rows_touch_board_insert
  after insert on public.rows
  referencing new table as changed_rows
  for each statement execute function public.touch_board();
create trigger rows_touch_board_update
  after update on public.rows
  referencing new table as changed_rows
  for each statement execute function public.touch_board();
create trigger rows_touch_board_delete
  after delete on public.rows
  referencing old table as changed_rows
  for each statement execute function public.touch_board();

-- A table with rows stays a table: another kind would hide them.
create function public.keep_rows_a_table()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.rows r where r.board_id = new.id) then
    raise exception using message = 'A table with rows cannot change kind; delete its rows first.', errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger boards_keep_rows_a_table
  before update of kind on public.boards
  for each row
  when (old.kind = 'table' and new.kind <> 'table')
  execute function public.keep_rows_a_table();

-- The checks run as the writer; the trigger functions only as triggers.
revoke all on function
  public.valid_columns(jsonb), public.cell_error(jsonb, jsonb), public.check_row(),
  public.check_columns_change(), public.touch_board(), public.keep_rows_a_table()
  from public, anon, authenticated;
grant execute on function public.valid_columns(jsonb), public.cell_error(jsonb, jsonb)
  to authenticated, service_role;

drop function public.shared_board(text);
create function public.shared_board(token text)
returns table (id uuid, title text, kind text, content text, columns jsonb, tags text[], image text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select b.id, b.title, b.kind, b.content, b.columns, b.tags, b.image, b.updated_at
  from public.boards b
  where b.share_token = shared_board.token;
$$;
revoke all on function public.shared_board(text) from public, anon, authenticated;
grant execute on function public.shared_board(text) to anon, authenticated, service_role;

create function public.shared_rows(token text)
returns table (id uuid, data jsonb, created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.data, r.created_at, r.updated_at
  from public.rows r
  join public.boards b on b.id = r.board_id
  where b.share_token = shared_rows.token
  order by r.created_at;
$$;
revoke all on function public.shared_rows(text) from public, anon, authenticated;
grant execute on function public.shared_rows(text) to anon, authenticated, service_role;
