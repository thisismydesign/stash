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
  Tooltip,
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
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  choiceColor,
  isLink,
  toCell,
  type Cell,
  type Column,
  type SharedRow,
} from "@shared/tables.ts";
import type { RowData, RowEdits } from "../lib/rows.tsx";
import {
  NO_FILTER,
  formatCell,
  formatNumber,
  isFiltering,
  moveItem,
  passes,
  total,
  type Filter,
} from "../lib/table.ts";
import { useDragOrder } from "../lib/useDragOrder.ts";
import { Setting, SettingsMenu } from "./Settings.tsx";

import "./table-view.css";

type Sort = { key: string; desc: boolean };
type Editing = { id: string; key: string };

/** Empty cells sort last either way. */
const compare = (a: Cell | undefined, b: Cell | undefined) => {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
};

const ACTIONS_WIDTH = 40;

/** Dragged at a heading's right edge; the width follows the pointer and is kept when it lets go. */
function ResizeHandle({
  width,
  onResize,
  onDone,
  onFit,
}: {
  width: number;
  onResize: (width: number) => void;
  onDone: (width: number) => void;
  /** A double click: as wide as the widest entry. */
  onFit: () => void;
}) {
  const start = useRef<{ x: number; width: number }>(undefined);
  const widthAt = (x: number) =>
    Math.round(
      Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, start.current!.width + x - start.current!.x),
      ),
    );
  const cancel = () => {
    start.current = undefined;
  };
  return (
    <div
      className="table-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start.current = { x: e.clientX, width };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => start.current && onResize(widthAt(e.clientX))}
      onPointerUp={(e) => {
        if (!start.current) return;
        const next = widthAt(e.clientX);
        const before = start.current.width;
        start.current = undefined;
        if (next !== before) onDone(next);
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onDoubleClick={onFit}
    />
  );
}

const CELL_PADDING = 24;

/** A link reads without its scheme. */
const linkText = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "");

/** How wide a column must be for its heading and every cell to show whole, measured as they read in the table's own font. */
function fittedWidth(table: HTMLElement, column: Column, rows: readonly SharedRow[]): number {
  if (column.type === "checkbox") return 100;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
  table.append(probe);
  const widthOf = (text: string, size: string, weight: string) => {
    probe.style.fontSize = size;
    probe.style.fontWeight = weight;
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  };
  // A choice sits in a badge: smaller, bolder, padded.
  const cellWidth = (value: Cell | undefined) => {
    const text = formatCell(column, value);
    if (column.type === "select") return widthOf(text, "var(--mantine-font-size-xs)", "700") + 20;
    if (column.type === "url") return widthOf(linkText(text), "var(--mantine-font-size-sm)", "400");
    return widthOf(text, "var(--mantine-font-size-sm)", "400");
  };
  const widest = Math.max(
    widthOf(column.name, "var(--mantine-font-size-sm)", "600") + 20,
    ...rows.map((r) => cellWidth(r.data[column.key])),
  );
  probe.remove();
  return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, widest + CELL_PADDING)));
}

/** Tells the whole of what it holds on hover, when the cell clips it. */
function Clipped({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const check = () => {
    const el = ref.current?.firstElementChild;
    setOpen(!!el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1));
  };
  return (
    <Tooltip
      label={label}
      opened={open}
      multiline
      maw={360}
      events={{ hover: false, focus: false, touch: false }}
    >
      <div ref={ref} onMouseEnter={check} onMouseLeave={() => setOpen(false)}>
        {children}
      </div>
    </Tooltip>
  );
}

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
                        <Chip key={o} value={o} size="xs" color={choiceColor(c, o)}>
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
      <Clipped label={value}>
        <Anchor
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          lineClamp={1}
          onClick={(e) => e.stopPropagation()}
        >
          {linkText(value)}
        </Anchor>
      </Clipped>
    );
  if (column.type === "select")
    return (
      <Badge variant="light" color={choiceColor(column, String(value))} size="sm" tt="none">
        {formatCell(column, value)}
      </Badge>
    );
  const text = formatCell(column, value);
  return (
    <Clipped label={text}>
      <Text size="sm" lineClamp={2} ta={column.type === "number" ? "right" : undefined}>
        {text}
      </Text>
    </Clipped>
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
  columns: given,
  rows,
  edit,
  onColumns,
  onError = () => undefined,
}: {
  columns: Column[];
  rows: readonly SharedRow[];
  edit?: RowEdits;
  /** Keeps the columns as dragged, wider or in another order; without it, a drag shows for the reader only. */
  onColumns?: (columns: Column[]) => Promise<void>;
  onError?: (message: string) => void;
}) {
  const [sort, setSort] = useState<Sort>();
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [editing, setEditing] = useState<Editing>();
  const table = useRef<HTMLTableElement>(null);
  // Widths and order as dragged, over what the columns say, so a drag shows at once; what the columns then say wins.
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<string[]>();
  useEffect(() => {
    setWidths({});
    setOrder(undefined);
  }, [given]);
  const columns = order ? order.flatMap((key) => given.filter((c) => c.key === key)) : given;
  const widthOf = (c: Column) => widths[c.key] ?? c.width ?? COLUMN_WIDTH;
  // Shown at once; what the columns said comes back if the keeping fails.
  const keep = (next: Column[]) => {
    setOrder(next.map((c) => c.key));
    onColumns?.(next).catch((e: Error) => {
      setOrder(undefined);
      setWidths({});
      onError(e.message);
    });
  };
  const resize = (key: string, width: number) =>
    keep(columns.map((c) => (c.key === key ? { ...c, width } : c)));
  const dragging = useDragOrder("x", (from, to) => keep(moveItem(columns, from, to)));
  const tableWidth = columns.reduce((w, c) => w + widthOf(c), 0) + (edit ? ACTIONS_WIDTH : 0);
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
    dragging.justDragged() ||
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
      {/* Bounded to the viewport, so the sideways scrollbar stays in reach however many rows there are. */}
      <Table.ScrollContainer
        minWidth={tableWidth}
        maxHeight="max(20rem, calc(100dvh - 20rem))"
        scrollAreaProps={{ type: "auto" }}
      >
        <Table
          withTableBorder
          withColumnBorders
          stickyHeader
          layout="fixed"
          highlightOnHover={!!edit}
          className="table-view"
          w={tableWidth}
          ref={table}
        >
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: widthOf(c) }} />
            ))}
            {edit && <col style={{ width: ACTIONS_WIDTH }} />}
          </colgroup>
          <Table.Thead>
            <Table.Tr>
              {columns.map((c, i) => (
                <Table.Th
                  key={c.key}
                  ta={c.type === "number" ? "right" : undefined}
                  pos="relative"
                  ref={dragging.item(i)}
                  className={dragging.className(i)}
                  {...dragging.handle(i)}
                >
                  <Tooltip
                    label={c.name}
                    openDelay={300}
                    events={{ hover: true, focus: true, touch: true }}
                  >
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
                  </Tooltip>
                  <ResizeHandle
                    width={widthOf(c)}
                    onResize={(w) => setWidths((all) => ({ ...all, [c.key]: w }))}
                    onDone={(w) => resize(c.key, w)}
                    onFit={() => resize(c.key, fittedWidth(table.current!, c, rows))}
                  />
                </Table.Th>
              ))}
              {edit && <Table.Th />}
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
