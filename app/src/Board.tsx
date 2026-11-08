import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPencil, IconShare } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { Board, BoardKind, Column, SharedBoard, SharedRow } from "@shared/tables.ts";
import { BoardMenu } from "./BoardMenu.tsx";
import { KindIcon, TagBadges, cleanTags, unique } from "./Boards.tsx";
import { ColumnsEditor } from "./components/ColumnsEditor.tsx";
import { HtmlView } from "./components/HtmlView.tsx";
import { Picture } from "./components/Picture.tsx";
import { Markdown } from "./components/Markdown.tsx";
import { MarkdownEditor } from "./components/MarkdownEditor.tsx";
import { TableView } from "./components/TableView.tsx";
import { useBoards } from "./lib/boards.tsx";
import { ago } from "./lib/format.ts";
import { useRows, type RowEdits } from "./lib/rows.tsx";
import { settle, toggleTask } from "./lib/todo.ts";
import { useLocalState } from "./lib/useLocalState.ts";
import { KIND_COLOR, KIND_LABEL, tagColors } from "./theme.ts";

type Draft = {
  title: string;
  tags: string[];
  content: string;
  description: string;
  columns: Column[];
};

const AUTOSAVE_MS = 800;

const PLACEHOLDER: Record<BoardKind, string> = {
  todo: "- [ ] First thing\n- [ ] Second thing\n  - [ ] A step of it",
  markdown: "# Notes\n\nAnything, in Markdown.",
  html: "<!doctype html>\n<html>\n  <body>\n    Your page.\n  </body>\n</html>",
  table: "",
};

export function KindBadge({ kind }: { kind: BoardKind }) {
  return (
    <Badge
      variant="light"
      color={KIND_COLOR[kind]}
      size="sm"
      leftSection={<KindIcon kind={kind} size={12} />}
    >
      {KIND_LABEL[kind]}
    </Badge>
  );
}

/** A table's rows as loaded; with `edit`, they can be changed, `onColumns` keeps columns as dragged, and `onError` hears of a change that failed. */
export type TableRows = {
  rows?: SharedRow[];
  error?: string;
  edit?: RowEdits;
  onColumns?: (columns: Column[]) => Promise<void>;
  onError?: (message: string) => void;
};

/** The board as read; with `onToggle`, a todo's boxes are live. A table shows `table`. */
export function BoardContent({
  board,
  onToggle,
  table,
}: {
  board: SharedBoard;
  onToggle?: (line: number) => void;
  table?: TableRows;
}) {
  if (board.kind === "html") return <HtmlView html={board.content} title={board.title} />;
  if (board.kind === "table") {
    if (table?.error)
      return (
        <Text size="sm" c="red">
          {table.error}
        </Text>
      );
    if (!table?.rows)
      return (
        <Group gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading rows…
          </Text>
        </Group>
      );
    return (
      <TableView
        columns={board.columns}
        rows={table.rows}
        edit={table.edit}
        onColumns={table.onColumns}
        onError={table.onError}
      />
    );
  }
  if (board.content.trim() === "") return <Text c="dimmed">Nothing here yet.</Text>;
  return <Markdown onToggle={onToggle}>{board.content}</Markdown>;
}

const draftOf = (board: Board): Draft => ({
  title: board.title,
  tags: board.tags,
  content: board.content,
  description: board.description,
  columns: board.columns,
});

type View = "formatted" | "source";

// A column not named yet is not a column yet.
const inputOf = (draft: Draft, board: Board) => ({
  title: draft.title.trim() || board.title,
  tags: cleanTags(draft.tags),
  content: draft.content,
  description: draft.description.trim(),
  columns: draft.columns.filter((c) => c.name.trim() !== ""),
});

function Editor({
  draft,
  kind,
  tags,
  onChange,
}: {
  draft: Draft;
  kind: BoardKind;
  tags: string[];
  onChange: (d: Draft) => void;
}) {
  const [view, setView] = useLocalState<View>("editor", "formatted");
  const markdown = kind === "todo" || kind === "markdown";
  const formatted = markdown && view === "formatted";
  return (
    <Stack gap="sm">
      <TagsInput
        label="Tags"
        size="sm"
        data={tags}
        value={draft.tags}
        onChange={(tags) => onChange({ ...draft, tags })}
      />
      <Textarea
        label="Description"
        size="sm"
        autosize
        minRows={1}
        placeholder="A line or two about this board, in Markdown"
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.currentTarget.value })}
      />
      {markdown && (
        <Group justify="flex-end">
          <SegmentedControl
            size="xs"
            value={view}
            onChange={(v) => setView(v as View)}
            data={[
              { value: "formatted", label: "Formatted" },
              { value: "source", label: "Source" },
            ]}
          />
        </Group>
      )}
      {kind === "table" ? (
        <ColumnsEditor
          columns={draft.columns}
          onChange={(columns) => onChange({ ...draft, columns })}
        />
      ) : formatted ? (
        <MarkdownEditor
          initial={draft.content}
          onChange={(content) => onChange({ ...draft, content })}
        />
      ) : (
        <Textarea
          aria-label="Content"
          autosize
          minRows={14}
          spellCheck={markdown}
          placeholder={PLACEHOLDER[kind]}
          value={draft.content}
          onChange={(e) => onChange({ ...draft, content: e.currentTarget.value })}
          styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 13 } }}
        />
      )}
    </Stack>
  );
}

export function BoardPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { boards, update, pictureSrc } = useBoards();
  const board = boards?.find((b) => b.id === id);
  const { rows, error: rowsError, ...rowEdits } = useRows(board?.kind === "table" ? id : undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(0);
  const opened = useRef<string>(undefined);
  // Only typing is saved: a draft left untouched must not overwrite what someone else wrote meanwhile.
  const written = useRef<Draft>(undefined);
  const dirty = !!draft && draft !== written.current;
  const edit = (board: Board) => {
    written.current = draftOf(board);
    setDraft(written.current);
  };

  const autosave = useRef<() => void>(undefined);
  autosave.current = async () => {
    if (!draft || !board || draft === written.current) return;
    written.current = draft;
    setSaving((n) => n + 1);
    setError(undefined);
    try {
      await update(board.id, inputOf(draft, board));
    } catch (e) {
      if (written.current === draft) written.current = undefined;
      setError((e as Error).message);
    } finally {
      setSaving((n) => n - 1);
    }
  };

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => autosave.current?.(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => () => autosave.current?.(), []);

  useEffect(() => {
    if (!dirty && saving === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  // A board with nothing on it yet opens ready to write.
  useEffect(() => {
    if (!board || opened.current === board.id) return;
    opened.current = board.id;
    if (board.kind === "table" ? board.columns.length === 0 : board.content === "") edit(board);
  }, [board]);

  if (!boards)
    return (
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Group>
    );
  if (!board)
    return (
      <Alert title="No such board">
        <Button variant="subtle" size="compact-sm" onClick={onBack}>
          All boards
        </Button>
      </Alert>
    );

  const tags = unique(boards.flatMap((b) => b.tags));
  const color = tagColors(tags);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    draft &&
    run(async () => {
      await update(board.id, inputOf(draft, board));
      setDraft(null);
    });
  const toggle = (line: number) => {
    const next = toggleTask(board.content, line);
    void run(() => update(board.id, { content: board.kind === "todo" ? settle(next) : next }));
  };

  return (
    <Stack
      gap="sm"
      style={{ flex: 1 }}
      onKeyDown={(e) => {
        if (draft && (e.metaKey || e.ctrlKey) && e.key === "s") {
          e.preventDefault();
          void save();
        }
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <ActionIcon variant="subtle" size="lg" aria-label="All boards" onClick={onBack}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          {draft ? (
            <TextInput
              aria-label="Title"
              size="md"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })}
              style={{ flex: 1 }}
            />
          ) : (
            <Title order={2} fz={{ base: "h3", sm: "h2" }} lineClamp={2}>
              {board.title}
            </Title>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {draft ? (
            <>
              {!error && (
                <Text size="xs" c="dimmed">
                  {dirty || saving > 0 ? "Saving…" : "Saved"}
                </Text>
              )}
              <Button size="sm" onClick={() => void save()} loading={busy}>
                Done
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              leftSection={<IconPencil size={16} />}
              onClick={() => edit(board)}
            >
              Edit
            </Button>
          )}
          <BoardMenu board={board} size="lg" onError={setError} onDeleted={onBack} />
        </Group>
      </Group>

      {!draft && (
        <Group gap={6}>
          <KindBadge kind={board.kind} />
          <TagBadges tags={board.tags} color={color} />
          {board.archived_at && (
            <Badge variant="outline" color="gray" size="sm">
              Archived
            </Badge>
          )}
          {board.share_token && (
            <Badge variant="outline" color="gray" size="sm" leftSection={<IconShare size={10} />}>
              Shared
            </Badge>
          )}
          <Text size="xs" c="dimmed" ml="auto">
            Updated {ago(board.updated_at)}
          </Text>
        </Group>
      )}
      {!draft && board.description && <Markdown>{board.description}</Markdown>}
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      {draft ? (
        <Editor draft={draft} kind={board.kind} tags={tags} onChange={setDraft} />
      ) : (
        <>
          {board.image && <Picture src={pictureSrc(board.image)} height={200} radius="md" />}
          <BoardContent
            board={board}
            onToggle={toggle}
            table={{
              rows,
              error: rowsError,
              edit: rowEdits,
              onError: setError,
              onColumns: (columns) => update(board.id, { columns }),
            }}
          />
        </>
      )}
    </Stack>
  );
}
