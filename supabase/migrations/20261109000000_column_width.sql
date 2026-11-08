-- A column may say how wide it shows, in pixels; a person drags a heading's edge to set it.

create or replace function public.valid_columns(columns jsonb)
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
        or (c ? 'width' and (
          jsonb_typeof(c->'width') <> 'number'
          or (c->>'width')::numeric not between 40 and 2000
        ))
        or exists (select 1 from jsonb_object_keys(c) k where k not in ('key', 'name', 'type', 'options', 'decimals', 'width'))
    )
    and (select count(*) = count(distinct c->>'key') from jsonb_array_elements(columns) c);
$$;
