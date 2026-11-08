import {
  ActionIcon,
  Button,
  CopyButton,
  FileInput,
  Group,
  Menu,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconArchive,
  IconArchiveOff,
  IconDots,
  IconDownload,
  IconPhoto,
  IconPin,
  IconPinnedOff,
  IconShare,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import {
  IMAGE_MAX_LENGTH,
  IMAGE_TYPES,
  isImageLink,
  shareLink,
  type Board,
} from "@shared/tables.ts";
import { useBoards } from "./lib/boards.tsx";
import { csvFileName, download, toCsv } from "./lib/csv.ts";
import { loadRows } from "./lib/rows.tsx";

function PictureModal({
  board,
  opened,
  onClose,
}: {
  board: Board;
  opened: boolean;
  onClose: () => void;
}) {
  const { local, setPicture } = useBoards();
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const url = link.trim();
  const close = () => {
    setFile(null);
    setLink("");
    setError(undefined);
    onClose();
  };
  const run = async (picture: File | string | null) => {
    if (typeof picture === "string" && !isImageLink(picture))
      return setError("The link must start with https://");
    if (typeof picture === "string" && picture.length > IMAGE_MAX_LENGTH)
      return setError("The link is too long.");
    setBusy(true);
    setError(undefined);
    try {
      await setPicture(board.id, picture);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened={opened} onClose={close} title={`Picture for “${board.title}”`} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (file || url) void run(file ?? url);
        }}
      >
        <Stack gap="sm">
          {!local && (
            <FileInput
              label="Upload"
              placeholder="PNG, JPEG, GIF, WebP or AVIF, up to 5 MB"
              accept={IMAGE_TYPES.join(",")}
              clearable
              value={file}
              onChange={setFile}
            />
          )}
          <TextInput
            label={local ? "Link" : "Or link to one"}
            placeholder="https://…"
            disabled={!!file}
            value={link}
            onChange={(e) => setLink(e.currentTarget.value)}
          />
          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}
          <Group justify="flex-end">
            {board.image && (
              <Button variant="default" size="sm" disabled={busy} onClick={() => void run(null)}>
                Remove
              </Button>
            )}
            <Button type="submit" size="sm" loading={busy} disabled={!file && !url}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function ShareModal({
  board,
  opened,
  onClose,
}: {
  board: Board;
  opened: boolean;
  onClose: () => void;
}) {
  const { share, unshare } = useBoards();
  // The switch shows the choice at once; the row follows.
  const [pending, setPending] = useState<boolean>();
  const [error, setError] = useState<string>();
  const link = board.share_token && shareLink(window.location.origin, board.share_token);
  const toggle = async (on: boolean) => {
    setPending(on);
    setError(undefined);
    try {
      await (on ? share : unshare)(board.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(undefined);
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title={`Share “${board.title}”`} size="sm">
      <Stack gap="sm">
        <Switch
          label="Anyone with the link can view"
          checked={pending ?? !!link}
          disabled={pending !== undefined}
          onChange={(e) => void toggle(e.currentTarget.checked)}
        />
        {link && (
          <Group gap="xs" wrap="nowrap">
            <TextInput
              aria-label="Link"
              size="sm"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: 1 }}
            />
            <CopyButton value={link}>
              {({ copied, copy }) => (
                <Button size="sm" variant="light" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </CopyButton>
          </Group>
        )}
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {link
            ? "Readers see the board as it is now and as it changes. Turn sharing off and the link stops working."
            : "Sharing makes a link that shows this board, read-only, to anyone who has it."}
        </Text>
      </Stack>
    </Modal>
  );
}

/** Pin, archive, share and delete, the same from a tile, a row or the board itself. */
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
  const { local, update, remove } = useBoards();
  const [confirm, setConfirm] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [picturing, setPicturing] = useState(false);
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
          <Menu.Item leftSection={<IconPhoto size={16} />} onClick={() => setPicturing(true)}>
            Picture…
          </Menu.Item>
          {board.kind === "table" && (
            <Menu.Item
              leftSection={<IconDownload size={16} />}
              onClick={() =>
                void run(async () =>
                  download(
                    csvFileName(board.title),
                    toCsv(board.columns, await loadRows(board.id, local)),
                  ),
                )
              }
            >
              Download CSV
            </Menu.Item>
          )}
          {!local && (
            <Menu.Item leftSection={<IconShare size={16} />} onClick={() => setSharing(true)}>
              {board.share_token ? "Sharing…" : "Share…"}
            </Menu.Item>
          )}
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
      {!local && <ShareModal board={board} opened={sharing} onClose={() => setSharing(false)} />}
      <PictureModal board={board} opened={picturing} onClose={() => setPicturing(false)} />
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
