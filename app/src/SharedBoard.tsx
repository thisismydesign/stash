import { ActionIcon, Alert, Badge, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isImageLink, type SharedBoard } from "@shared/tables.ts";
import { BoardContent, KindBadge } from "./Board.tsx";
import { TagBadges, unique } from "./Boards.tsx";
import { Picture } from "./components/Picture.tsx";
import { ago } from "./lib/format.ts";
import { API_BASE, supabase } from "./lib/supabase.ts";
import { useReloadOnReturn } from "./lib/useReloadOnReturn.ts";
import { tagColors } from "./theme.ts";

type State = { board?: SharedBoard | null; error?: string };

/** What a link's holder sees: the board, read-only, signed in or not. */
export function SharedBoardPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [state, setState] = useState<State>({});
  // Only the latest request's answer may land.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const turn = ++latest.current;
    const { data, error } = await supabase!.rpc("shared_board", { token }).maybeSingle();
    if (turn !== latest.current) return;
    setState(error ? { error: error.message } : { board: data as SharedBoard | null });
  }, [token]);

  useEffect(() => {
    setState({});
    void load();
  }, [load]);
  useReloadOnReturn(load);

  if (state.error)
    return (
      <Alert color="red" title="Board unavailable">
        {state.error}
      </Alert>
    );
  if (state.board === undefined)
    return (
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Group>
    );
  const board = state.board;
  if (!board)
    return (
      <Alert title="This link no longer works">
        <Text size="sm" mb="xs">
          The board was unshared or deleted.
        </Text>
        <Button variant="subtle" size="compact-sm" onClick={onBack}>
          Go to Stash
        </Button>
      </Alert>
    );

  return (
    <Stack gap="sm" style={{ flex: 1 }}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <ActionIcon variant="subtle" size="lg" aria-label="Go to Stash" onClick={onBack}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={2} fz={{ base: "h3", sm: "h2" }} lineClamp={2}>
          {board.title}
        </Title>
      </Group>
      <Group gap={6}>
        <KindBadge kind={board.kind} />
        <TagBadges tags={board.tags} color={tagColors(unique(board.tags))} />
        <Badge variant="outline" color="gray" size="sm">
          Shared with you
        </Badge>
        <Text size="xs" c="dimmed" ml="auto">
          Updated {ago(board.updated_at)}
        </Text>
      </Group>
      {board.image && (
        <Picture
          src={
            isImageLink(board.image)
              ? board.image
              : `${API_BASE}/image?token=${encodeURIComponent(token)}`
          }
          height={200}
          radius="md"
        />
      )}
      <BoardContent board={board} />
    </Stack>
  );
}
