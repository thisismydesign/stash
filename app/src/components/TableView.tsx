import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Chip,
  Group,
  Menu,
  NativeSelect,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowDown,
  IconArrowUp,
  IconDots,
  IconFilter,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { isLink, toCell, type Cell, type Column, type SharedRow } from "@shared/tables.ts";
import type { RowData, RowEdits } from "../lib/rows.tsx";
import {
  NO_FILTER,
  formatCell,
  formatNumber,
  isFiltering,
  passes,
  total,
  type Filter,
} from "../lib/table.ts";
import { Setting, SettingsMenu } from "./Settings.tsx";

import "./table-view.css";

type Sort = { key: string; desc: boolean };
type Editing = { id: string; key: string };

const COLUMN_WIDTH = 150;

/** Empty cells sort last either way. */
const compare = (a: Cell | undefined, b: Cell | undefined) => {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
};

const without = (data: RowData, key: string) => {
  const rest = { ...data };
  delete rest[key];
  return rest;
};

function Filters({
  columns,
  filter,
  onChange,
}: {
  columns: Column[];
  filter: Filter;
  onChange: (f: Filter) => void;
}) {
  const narrowing = columns.filter((c) => ["select", "checkbox", "date"].includes(c.type));
  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput
        size="sm"
        placeholder="Filter rows"
        aria-label="Filter rows"
        leftSection={<IconSearch size={16} />}
        value={filter.query}
        onChange={(e) => onChange({ ...filter, query: e.currentTarget.value })}
        style={{ flex: 1, minWidth: 0, maxWidth: 420 }}
      />
      {narrowing.length > 0 && (
        <SettingsMenu
          label="Filters"
          width={300}
          icon={IconFilter}
          active={isFiltering({ ...filter, query: "" })}
        >
          <Stack gap="md">
            {narrowing.map((c) =>
              c.type === "select" ? (
                <Setting key={c.key} label={c.name}>
                  <Chip.Group
                    multiple
                    value={filter.choices[c.key] ?? []}
                    onChange={(chosen) =>
                      onChange({ ...filter, choices: { ...filter.choices, [c.key]: chosen } })
                    }
                  >
                    <Group gap={6}>
                      {(c.options ?? []).map((o) => (
                        <Chip key={o} value={o} size="xs">
                          {o}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                </Setting>
              ) : c.type === "checkbox" ? (
                <Checkbox
                  key={c.key}
                  size="sm"
                  label={`${c.name} only`}
                  checked={filter.ticked[c.key] ?? false}
                  onChange={(e) =>
                    onChange({
                      ...filter,
                      ticked: { ...filter.ticked, [c.key]: e.currentTarget.checked },
                    })
                  }
                />
              ) : (
                <Setting key={c.key} label={c.name}>
                  <Group gap="xs" grow>
                    <TextInput
                      size="xs"
                      type="date"
                      aria-label={`${c.name} from`}
                      value={filter.from[c.key] ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...filter,
                          from: { ...filter.from, [c.key]: e.currentTarget.value },
                        })
                      }
                    />
                    <TextInput
                      size="xs"
                      type="date"
                      aria-label={`${c.name} to`}
                      value={filter.to[c.key] ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...filter,
                          to: { ...filter.to, [c.key]: e.currentTarget.value },
                        })
                      }
                    />
                  </Group>
                </Setting>
              ),
            )}
            {isFiltering({ ...filter, query: "" }) && (
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => onChange({ ...NO_FILTER, query: filter.query })}
              >
                Clear filters
              </Button>
            )}
          </Stack>
        </SettingsMenu>
      )}
    </Group>
  );
}

function Shown({ column, value }: { column: Column; value: Cell | undefined }) {
  if (value == null) return null;
  if (column.type === "checkbox") return <Checkbox size="xs" checked={value === true} readOnly />;
  if (column.type === "url" && typeof value === "string" && isLink(value))
    return (
      <Anchor
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        size="sm"
        lineClamp={1}
        onClick={(e) => e.stopPropagation()}
      >
        {value.replace(/^https?:\/\/(www\.)?/, "")}
      </Anchor>
    );
  if (column.type === "select")
    return (
      <Badge variant="light" color="gray" size="sm" tt="none">
        {formatCell(column, value)}
      </Badge>
    );
  return (
    <Text size="sm" lineClamp={2} ta={column.type === "number" ? "right" : undefined}>
      {formatCell(column, value)}
    </Text>
  );
}

const NOT_A: Record<Column["type"], string> = {
  text: "",
  number: "a number",
  date: "a date as YYYY-MM-DD",
  checkbox: "",
  select: "",
  url: "a link starting with https://",
};

function Input({
  column,
  value,
  onDone,
  onError,
}: {
  column: Column;
  value: Cell | undefined;
  /** With the cell as typed, or undefined to leave it as it was. */
  onDone: (cell: Cell | undefined) => void;
  onError: (message: string) => void;
}) {
  const initial = value == null ? "" : String(value);
  const [text, setText] = useState(initial);
  // Enter commits and the input's going blurs it: once is enough.
  const done = useRef(false);
  const finish = (cell: Cell | undefined) => {
    if (done.current) return;
    done.current = true;
    onDone(cell);
  };
  // A typo keeps the cell as it was rather than emptying it.
  const commit = () => {
    if (done.current) return;
    if (text === initial) return finish(undefined);
    const cell = toCell(column, text);
    if (cell === null && text.trim() !== "") {
      onError(`“${text.trim()}” is not ${NOT_A[column.type]}; ${column.name} kept as it was.`);
      return finish(undefined);
    }
    finish(cell);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") finish(undefined);
  };
  if (column.type === "select")
    return (
      <NativeSelect
        size="xs"
        autoFocus
        aria-label={column.name}
        data={[
          { value: "", label: "—" },
          ...(column.options ?? []).map((o) => ({ value: o, label: o })),
          ...(initial && !column.options?.includes(initial) ? [initial] : []),
        ]}
        value={text}
        onChange={(e) => {
          setText(e.currentTarget.value);
          finish(toCell(column, e.currentTarget.value));
        }}
        onBlur={commit}
        onKeyDown={keys}
      />
    );
  return (
    <TextInput
      size="xs"
      autoFocus
      aria-label={column.name}
      type={column.type === "date" ? "date" : column.type === "url" ? "url" : "text"}
      inputMode={column.type === "number" ? "decimal" : undefined}
      value={text}
      onChange={(e) => setText(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={keys}
    />
  );
}

function CellView({
  column,
  row,
  editing,
  edit,
  onEdit,
  onError,
}: {
  column: Column;
  row: SharedRow;
  editing: boolean;
  edit?: RowEdits;
  onEdit: (on: boolean) => void;
  onError: (message: string) => void;
}) {
  const value = row.data[column.key];
  const write = (cell: Cell) =>
    edit
      ?.change(
        row.id,
        cell === null ? without(row.data, column.key) : { ...row.data, [column.key]: cell },
      )
      .catch((e: Error) => onError(e.message));
  if (edit && column.type === "checkbox")
    return (
      <Table.Td>
        <Checkbox
          size="xs"
          aria-label={column.name}
          checked={value === true}
          onChange={(e) => void write(e.currentTarget.checked)}
        />
      </Table.Td>
    );
  if (edit && editing)
    return (
      <Table.Td p={4}>
        <Input
          column={column}
          value={value}
          onError={onError}
          onDone={(cell) => {
            onEdit(false);
            if (cell !== undefined) void write(cell);
          }}
        />
      </Table.Td>
    );
  return (
    <Table.Td
      className={edit ? "table-editable" : undefined}
      tabIndex={edit ? 0 : undefined}
      onClick={edit ? () => onEdit(true) : undefined}
      onKeyDown={edit ? (e) => e.key === "Enter" && onEdit(true) : undefined}
      ta={column.type === "number" ? "right" : undefined}
    >
      <Shown column={column} value={value} />
    </Table.Td>
  );
}

/** A table's rows under its columns, filtered and sorted as asked; with `edit`, cells take a click to change and rows come and go, and `onError` hears of a change that failed. */
export function TableView({
  columns,
  rows,
  edit,
  onError = () => undefined,
}: {
  columns: Column[];
  rows: readonly SharedRow[];
  edit?: RowEdits;
  onError?: (message: string) => void;
}) {
  const [sort, setSort] = useState<Sort>();
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [editing, setEditing] = useState<Editing>();
  if (columns.length === 0)
    return (
      <Text c="dimmed">
        {edit ? "No columns yet. Edit the table to add some." : "This table has no columns."}
      </Text>
    );
  const filtered = isFiltering(filter) ? rows.filter((r) => passes(columns, filter, r)) : rows;
  const shown = sort
    ? [...filtered].sort(
        (a, b) => compare(a.data[sort.key], b.data[sort.key]) * (sort.desc ? -1 : 1),
      )
    : filtered;
  const sortBy = (key: string) =>
    setSort(
      !sort || sort.key !== key
        ? { key, desc: false }
        : sort.desc
          ? undefined
          : { key, desc: true },
    );
  const attempt = (change: Promise<unknown>) => change.catch((e: Error) => onError(e.message));
  const addRow = () =>
    attempt(edit!.add({}).then((row) => setEditing({ id: row.id, key: columns[0].key })));
  const count =
    filtered.length === rows.length
      ? `${rows.length} ${rows.length === 1 ? "row" : "rows"}`
      : `${filtered.length} of ${rows.length} rows`;

  return (
    <>
      {rows.length > 0 && <Filters columns={columns} filter={filter} onChange={setFilter} />}
      <Table.ScrollContainer minWidth={columns.length * COLUMN_WIDTH + (edit ? 40 : 0)}>
        <Table withTableBorder withColumnBorders highlightOnHover={!!edit} className="table-view">
          <Table.Thead>
            <Table.Tr>
              {columns.map((c) => (
                <Table.Th key={c.key} ta={c.type === "number" ? "right" : undefined}>
                  <UnstyledButton
                    onClick={() => sortBy(c.key)}
                    className="table-sort"
                    aria-label={`Sort by ${c.name}`}
                  >
                    <Group
                      gap={4}
                      wrap="nowrap"
                      justify={c.type === "number" ? "flex-end" : undefined}
                    >
                      <Text size="sm" fw={600} lineClamp={1}>
                        {c.name}
                      </Text>
                      {sort?.key === c.key &&
                        (sort.desc ? <IconArrowDown size={14} /> : <IconArrowUp size={14} />)}
                    </Group>
                  </UnstyledButton>
                </Table.Th>
              ))}
              {edit && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shown.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={columns.length + (edit ? 1 : 0)}>
                  <Text size="sm" c="dimmed">
                    {rows.length === 0 ? "No rows yet." : "No row matches."}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {shown.map((row) => (
              <Table.Tr key={row.id}>
                {columns.map((c) => (
                  <CellView
                    key={c.key}
                    column={c}
                    row={row}
                    edit={edit}
                    editing={editing?.id === row.id && editing.key === c.key}
                    onEdit={(on) => setEditing(on ? { id: row.id, key: c.key } : undefined)}
                    onError={onError}
                  />
                ))}
                {edit && (
                  <Table.Td p={0} ta="center">
                    <Menu position="bottom-end" shadow="md" width={160}>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label="Row actions"
                        >
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={16} />}
                          onClick={() => void attempt(edit.remove(row.id))}
                        >
                          Delete row
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
          {rows.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                {columns.map((c, i) => (
                  <Table.Th key={c.key} ta={c.type === "number" ? "right" : undefined}>
                    {c.type === "number" ? (
                      <Text size="sm" fw={600} aria-label={`Total ${c.name}`}>
                        {formatNumber(total(filtered, c.key), c.decimals)}
                      </Text>
                    ) : i === 0 ? (
                      <Text size="xs" c="dimmed">
                        {count}
                      </Text>
                    ) : null}
                  </Table.Th>
                ))}
                {edit && <Table.Th />}
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Table.ScrollContainer>
      {edit && (
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconPlus size={16} />}
          onClick={() => void addRow()}
          style={{ alignSelf: "flex-start" }}
        >
          Add row
        </Button>
      )}
    </>
  );
}
