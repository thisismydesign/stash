import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NativeSelect,
  NumberInput,
  Paper,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { IconGripVertical, IconPlus, IconTrash } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { COLUMN_TYPES, columnKey, type Column, type ColumnType } from "@shared/tables.ts";
import { moveItem } from "../lib/table.ts";
import { useDragOrder } from "../lib/useDragOrder.ts";

import "./columns-editor.css";

const TYPE_LABEL: Record<ColumnType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  checkbox: "Checkbox",
  select: "Choice",
  url: "Link",
};

/** A table's columns, to add, rename, retype or drop. A column's key follows its name until the editing is over, then stays, so rows keep their cells. */
export function ColumnsEditor({
  columns,
  onChange,
}: {
  columns: Column[];
  onChange: (columns: Column[]) => void;
}) {
  const fresh = useRef(new Set<string>());
  const dragging = useDragOrder("y", (from, to) => onChange(moveItem(columns, from, to)));
  // The column whose removal awaits a yes; a fresh one has no cells to lose and goes at once.
  const [removing, setRemoving] = useState<number>();
  const drop = (i: number) => {
    onChange(columns.filter((_, n) => n !== i));
    setRemoving(undefined);
  };
  const others = (i: number) => columns.filter((_, n) => n !== i).map((c) => c.key);
  const set = (i: number, column: Column) =>
    onChange(columns.map((c, n) => (n === i ? column : c)));
  const rename = (i: number, name: string) => {
    const column = columns[i];
    if (!fresh.current.has(column.key)) return set(i, { ...column, name });
    const key = columnKey(name, others(i));
    fresh.current.delete(column.key);
    fresh.current.add(key);
    set(i, { ...column, key, name });
  };
  // A type's own fields go with it; what every column has, such as its width, stays.
  const retype = (i: number, type: ColumnType) => {
    const column: Column = { ...columns[i], type };
    delete column.options;
    delete column.decimals;
    if (type === "select") column.options = [];
    set(i, column);
  };
  const add = () => {
    const key = columnKey(
      "",
      columns.map((c) => c.key),
    );
    fresh.current.add(key);
    onChange([...columns, { key, name: "", type: "text" }]);
  };
  return (
    <Stack gap="xs" className="columns-editor">
      <Text size="sm" fw={500}>
        Columns
      </Text>
      {columns.map((c, i) => (
        <Paper key={i} withBorder p="xs" ref={dragging.item(i)} className={dragging.className(i)}>
          <Stack gap="xs">
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="input-xs"
                className="columns-grip"
                aria-label={`Move column ${c.name || c.key}`}
                {...dragging.handle(i)}
              >
                <IconGripVertical size={16} />
              </ActionIcon>
              <TextInput
                label="Name"
                size="xs"
                autoFocus={c.name === ""}
                value={c.name}
                onChange={(e) => rename(i, e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <NativeSelect
                label="Type"
                size="xs"
                value={c.type}
                onChange={(e) => retype(i, e.currentTarget.value as ColumnType)}
                data={COLUMN_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
                w={110}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                size="input-xs"
                aria-label={`Remove column ${c.name || c.key}`}
                onClick={() => (fresh.current.has(c.key) ? drop(i) : setRemoving(i))}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            {c.type === "select" && (
              <TagsInput
                label="Choices"
                size="xs"
                value={c.options ?? []}
                onChange={(options) => set(i, { ...c, options })}
                placeholder="Type one and press Enter"
              />
            )}
            {c.type === "number" && (
              <NumberInput
                label="Decimals"
                size="xs"
                min={0}
                max={10}
                allowDecimal={false}
                placeholder="As written"
                value={c.decimals ?? ""}
                onChange={(v) => {
                  const column = { ...c };
                  delete column.decimals;
                  set(i, typeof v === "number" ? { ...c, decimals: v } : column);
                }}
                w={120}
              />
            )}
            <Text size="xs" c="dimmed">
              Key: {c.key}
            </Text>
          </Stack>
        </Paper>
      ))}
      <Button
        variant="light"
        size="compact-sm"
        leftSection={<IconPlus size={16} />}
        onClick={add}
        style={{ alignSelf: "flex-start" }}
      >
        Add column
      </Button>
      <Modal
        opened={removing !== undefined}
        onClose={() => setRemoving(undefined)}
        title={`Remove “${removing === undefined ? "" : columns[removing]?.name}”?`}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">The column and its cells go from every row.</Text>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setRemoving(undefined)}>
              Keep
            </Button>
            <Button color="red" size="sm" onClick={() => removing !== undefined && drop(removing)}>
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
