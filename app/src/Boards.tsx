import {
  Alert,
  Badge,
  Button,
  Card,
  Chip,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCode,
  IconLayoutGrid,
  IconListCheck,
  IconListDetails,
  IconMarkdown,
  IconPin,
  IconPlus,
  IconSearch,
  IconSquare,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { BOARD_KINDS, type Board, type BoardKind } from "@shared/tables.ts";
import { BoardMenu } from "./BoardMenu.tsx";
import { Setting, SettingsMenu } from "./components/Settings.tsx";
import { useBoards } from "./lib/boards.tsx";
import { ago } from "./lib/format.ts";
import { preview } from "./lib/preview.ts";
import { useLocalState } from "./lib/useLocalState.ts";
import { KIND_COLOR, KIND_LABEL, tagColors } from "./theme.ts";

const KIND_ICON: Record<BoardKind, typeof IconCode> = {
  todo: IconListCheck,
  markdown: IconMarkdown,
  html: IconCode,
};

export function KindIcon({ kind, size = 16 }: { kind: BoardKind; size?: number }) {
  const Icon = KIND_ICON[kind];
  return (
    <Icon
      size={size}
      style={{ color: `var(--mantine-color-${KIND_COLOR[kind]}-6)`, flexShrink: 0 }}
    />
  );
}

export const unique = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const cleanTags = (tags: string[]) =>
  unique(tags.map((t) => t.trim().toLowerCase().replace(/^#+/, "")));

type Color = (tag: string) => string;

export function TagBadges({ tags, color }: { tags: string[]; color: Color }) {
  return tags.map((tag) => (
    <Badge key={tag} variant="light" color={color(tag)} size="sm" tt="none">
      {tag}
    </Badge>
  ));
}

/** Tinted in its colour when off, solid when on; Mantine's own chip only colours the on state. */
function TagChip({ tag, color, checked }: { tag: string; color: string; checked: boolean }) {
  return (
    <Chip
      value={tag}
      size="xs"
      color={color}
      variant={checked ? "filled" : "light"}
      styles={
        checked
          ? undefined
          : {
              label: {
                color: `var(--mantine-color-${color}-light-color)`,
                background: `var(--mantine-color-${color}-light)`,
              },
            }
      }
    >
      {tag}
    </Chip>
  );
}

type ListProps = {
  boards: Board[];
  color: Color;
  onOpen: (id: string) => void;
  onError: (message: string) => void;
};

function Tile({ board, color, onOpen, onError }: Omit<ListProps, "boards"> & { board: Board }) {
  const p = preview(board);
  return (
    <Card withBorder padding="md" pos="relative" style={{ display: "flex" }}>
      <UnstyledButton
        onClick={() => onOpen(board.id)}
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap={6} wrap="nowrap" pr={28}>
            <KindIcon kind={board.kind} />
            <Text fw={600} lineClamp={1}>
              {board.title}
            </Text>
            {board.pinned && <IconPin size={14} aria-label="Pinned" style={{ flexShrink: 0 }} />}
          </Group>
          <Text size="sm" c="dimmed" lineClamp={p.open ? 1 : 3}>
            {p.text}
          </Text>
          {p.open?.map((item, i) => (
            <Group key={i} gap={6} wrap="nowrap">
              <IconSquare size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
              <Text size="sm" lineClamp={1}>
                {item}
              </Text>
            </Group>
          ))}
          <Group gap={4} mt="auto" pt={4}>
            <TagBadges tags={board.tags} color={color} />
            <Text size="xs" c="dimmed" ml="auto">
              {ago(board.updated_at)}
            </Text>
          </Group>
        </Stack>
      </UnstyledButton>
      <div style={{ position: "absolute", top: 10, right: 10 }}>
        <BoardMenu board={board} onError={onError} />
      </div>
    </Card>
  );
}

function Rows({ boards, color, onOpen, onError }: ListProps) {
  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Tbody>
        {boards.map((b) => (
          <Table.Tr key={b.id} onClick={() => onOpen(b.id)} style={{ cursor: "pointer" }}>
            <Table.Td>
              <Group gap={6} wrap="nowrap">
                <KindIcon kind={b.kind} />
                <Text fw={500} component="span" role="link">
                  {b.title}
                </Text>
                {b.pinned && <IconPin size={14} aria-label="Pinned" />}
              </Group>
            </Table.Td>
            <Table.Td visibleFrom="sm">
              <Group gap={4}>
                <TagBadges tags={b.tags} color={color} />
              </Group>
            </Table.Td>
            <Table.Td ta="right" c="dimmed" fz="sm" style={{ whiteSpace: "nowrap" }}>
              {ago(b.updated_at)}
            </Table.Td>
            <Table.Td w={36} p={0} onClick={(e) => e.stopPropagation()}>
              <BoardMenu board={b} onError={onError} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function Section({ title, view, ...list }: ListProps & { title?: string; view: "tiles" | "list" }) {
  if (list.boards.length === 0) return null;
  return (
    <Stack gap="xs">
      {title && (
        <Text component="h2" size="xs" fw={600} c="dimmed" tt="uppercase" m={0}>
          {title}
        </Text>
      )}
      {view === "tiles" ? (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="md">
          {list.boards.map((b) => (
            <Tile key={b.id} board={b} {...list} />
          ))}
        </SimpleGrid>
      ) : (
        <Rows {...list} />
      )}
    </Stack>
  );
}

function NewBoard({
  opened,
  tags: known,
  onClose,
  onCreated,
}: {
  opened: boolean;
  tags: string[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { create } = useBoards();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<BoardKind>("todo");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const board = await create({ title: title.trim(), kind, content: "", tags: cleanTags(tags) });
      setTitle("");
      setKind("todo");
      setTags([]);
      onCreated(board.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title="New board">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) void submit();
        }}
      >
        <Stack gap="sm">
          <TextInput
            label="Title"
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <SegmentedControl
            fullWidth
            value={kind}
            onChange={(v) => setKind(v as BoardKind)}
            data={BOARD_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
          <TagsInput
            label="Tags"
            data={known}
            value={tags}
            onChange={setTags}
            placeholder="travel, home, cars…"
          />
          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}
          <Button type="submit" loading={busy} disabled={!title.trim()}>
            Create
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

const matches = (board: Board, query: string) => {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    board.title.toLowerCase().includes(q) ||
    board.content.toLowerCase().includes(q) ||
    board.tags.some((t) => t.includes(q))
  );
};

export function BoardsPage({ onOpen }: { onOpen: (id: string) => void }) {
  const { boards, local, error } = useBoards();
  const [view, setView] = useLocalState<"tiles" | "list">("boards:view", "tiles");
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const shown = useMemo(
    () => (boards ?? []).filter((b) => archived || !b.archived_at),
    [boards, archived],
  );
  const allTags = useMemo(() => unique(shown.flatMap((b) => b.tags)), [shown]);
  // Colours come from every board, archived too, so a tag keeps its colour on every page and view.
  const color = tagColors(unique((boards ?? []).flatMap((b) => b.tags)));
  const visible = shown
    .filter((b) => tags.every((t) => b.tags.includes(t)))
    .filter((b) => matches(b, query));
  const live = visible.filter((b) => !b.archived_at);
  const sections = [
    { title: "Pinned", boards: live.filter((b) => b.pinned) },
    { title: "Boards", boards: live.filter((b) => !b.pinned) },
    { title: "Archived", boards: visible.filter((b) => !!b.archived_at) },
  ];

  // A failed refresh keeps what is already on screen.
  if (error && !boards)
    return (
      <Alert color="red" title="Boards unavailable">
        {error}
      </Alert>
    );
  if (!boards)
    return (
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading boards…
        </Text>
      </Group>
    );

  const list = { view, color, onOpen, onError: setActionError };
  const filtering = tags.length > 0 || archived;
  return (
    <Stack gap="md">
      <Group gap="xs" wrap="nowrap" justify="center">
        <SettingsMenu label="View and filters" width={300} active={filtering}>
          <Stack gap="md">
            <Setting label="View">
              <SegmentedControl
                fullWidth
                size="xs"
                value={view}
                onChange={(v) => setView(v as "tiles" | "list")}
                data={[
                  { value: "tiles", label: <IconLayoutGrid size={16} aria-label="Tiles" /> },
                  { value: "list", label: <IconListDetails size={16} aria-label="List" /> },
                ]}
              />
            </Setting>
            {allTags.length > 0 && (
              <Setting label="Tags">
                <Chip.Group multiple value={tags} onChange={setTags}>
                  <Group gap={6}>
                    {allTags.map((t) => (
                      <TagChip key={t} tag={t} color={color(t)} checked={tags.includes(t)} />
                    ))}
                  </Group>
                </Chip.Group>
              </Setting>
            )}
            <Switch
              size="sm"
              label="Show archived"
              checked={archived}
              onChange={(e) => setArchived(e.currentTarget.checked)}
            />
            {filtering && (
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => {
                  setTags([]);
                  setArchived(false);
                }}
              >
                Clear filters
              </Button>
            )}
          </Stack>
        </SettingsMenu>
        <TextInput
          size="sm"
          placeholder="Search"
          aria-label="Search boards"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 0, maxWidth: 420 }}
        />
        <Button
          size="sm"
          px="sm"
          leftSection={<IconPlus size={16} />}
          aria-label="New board"
          onClick={() => setCreating(true)}
        >
          New
        </Button>
      </Group>
      {actionError && (
        <Alert color="red" withCloseButton onClose={() => setActionError(undefined)}>
          {actionError}
        </Alert>
      )}
      {visible.length === 0 ? (
        <Text c="dimmed" py="xl" ta="center">
          {boards.length > 0
            ? "No board matches."
            : local
              ? "No boards left. Make one, or sign in for your own."
              : "No boards yet. Make one, or ask your agent to."}
        </Text>
      ) : (
        sections.map((s) => (
          <Section
            key={s.title}
            title={s.title === "Boards" && sections[0].boards.length === 0 ? undefined : s.title}
            boards={s.boards}
            {...list}
          />
        ))
      )}
      <NewBoard
        opened={creating}
        tags={allTags}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          onOpen(id);
        }}
      />
    </Stack>
  );
}
