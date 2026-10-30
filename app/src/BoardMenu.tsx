import { ActionIcon, Button, Group, Menu, Modal, Stack, Text } from "@mantine/core";
import {
  IconArchive,
  IconArchiveOff,
  IconDots,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import type { Board } from "@shared/tables.ts";
import { useBoards } from "./lib/boards.tsx";

/** Pin, archive and delete, the same from a tile, a row or the board itself. */
export function BoardMenu({
  board,
  size = "sm",
  onError,
  onDeleted,
}: {
  board: Board;
  size?: "sm" | "lg";
  onError?: (message: string) => void;
  onDeleted?: () => void;
}) {
  const { update, remove } = useBoards();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError?.((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Menu position="bottom-end" shadow="md" width={180}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={size}
            aria-label={`Actions for ${board.title}`}
          >
            <IconDots size={size === "lg" ? 20 : 16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={board.pinned ? <IconPinnedOff size={16} /> : <IconPin size={16} />}
            onClick={() => void run(() => update(board.id, { pinned: !board.pinned }))}
          >
            {board.pinned ? "Unpin" : "Pin"}
          </Menu.Item>
          <Menu.Item
            leftSection={
              board.archived_at ? <IconArchiveOff size={16} /> : <IconArchive size={16} />
            }
            onClick={() =>
              void run(() =>
                update(board.id, {
                  archived_at: board.archived_at ? null : new Date().toISOString(),
                }),
              )
            }
          >
            {board.archived_at ? "Restore" : "Archive"}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => setConfirm(true)}
          >
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal
        opened={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete “${board.title}”?`}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">The board and everything on it go for good.</Text>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button
              color="red"
              size="sm"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await remove(board.id);
                  setConfirm(false);
                  onDeleted?.();
                })
              }
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
