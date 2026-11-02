import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPencil, IconShare } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { Board, BoardKind, SharedBoard } from "@shared/tables.ts";
import { BoardMenu } from "./BoardMenu.tsx";
import { KindIcon, TagBadges, cleanTags, unique } from "./Boards.tsx";
import { HtmlView } from "./components/HtmlView.tsx";
import { Picture } from "./components/Picture.tsx";
import { Markdown } from "./components/Markdown.tsx";
import { useBoards } from "./lib/boards.tsx";
import { ago } from "./lib/format.ts";
import { settle, toggleTask } from "./lib/todo.ts";
import { KIND_COLOR, KIND_LABEL, tagColors } from "./theme.ts";

type Draft = { title: string; tags: string[]; content: string };

const PLACEHOLDER: Record<BoardKind, string> = {
  todo: "- [ ] First thing\n- [ ] Second thing\n  - [ ] A step of it",
  markdown: "# Notes\n\nAnything, in Markdown.",
  html: "<!doctype html>\n<html>\n  <body>\n    Your page.\n  </body>\n</html>",
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

/** The board as read; with `onToggle`, a todo's boxes are live. */
export function BoardContent({
  board,
  onToggle,
}: {
  board: SharedBoard;
  onToggle?: (line: number) => void;
}) {
  if (board.kind === "html") return <HtmlView html={board.content} title={board.title} />;
  if (board.content.trim() === "") return <Text c="dimmed">Nothing here yet.</Text>;
  return <Markdown onToggle={onToggle}>{board.content}</Markdown>;
}

const draftOf = (board: Board): Draft => ({
  title: board.title,
  tags: board.tags,
  content: board.content,
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
        aria-label="Content"
        autosize
        minRows={14}
        spellCheck={kind !== "html"}
        placeholder={PLACEHOLDER[kind]}
        value={draft.content}
        onChange={(e) => onChange({ ...draft, content: e.currentTarget.value })}
        styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 13 } }}
      />
    </Stack>
  );
}

export function BoardPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { boards, update, pictureSrc } = useBoards();
  const board = boards?.find((b) => b.id === id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const opened = useRef<string>(undefined);

  // A board with nothing on it yet opens ready to write.
  useEffect(() => {
    if (!board || opened.current === board.id) return;
    opened.current = board.id;
    if (board.content === "") setDraft(draftOf(board));
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
      await update(board.id, {
        title: draft.title.trim() || board.title,
        tags: cleanTags(draft.tags),
        content: draft.content,
      });
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
              <Button variant="default" size="sm" onClick={() => setDraft(null)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void save()} loading={busy}>
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              leftSection={<IconPencil size={16} />}
              onClick={() => setDraft(draftOf(board))}
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
          <BoardContent board={board} onToggle={toggle} />
        </>
      )}
    </Stack>
  );
}
