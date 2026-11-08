import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isImageLink, readColumns, type Board, type BoardInput } from "@shared/tables.ts";
import { demoBoard, demoBoards } from "./demo/index.ts";
import { SIGNED_URL_SECONDS, removeImage, signImages, uploadImage } from "./images.ts";
import { supabase, useSession } from "./supabase.ts";
import { useReloadOnReturn } from "./useReloadOnReturn.ts";

type Boards = {
  /** Undefined while loading. */
  boards: Board[] | undefined;
  /** Signed out: the example boards, kept in memory. */
  local: boolean;
  error?: string;
  reload: () => Promise<void>;
  create: (input: BoardInput) => Promise<Board>;
  update: (id: string, input: BoardInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Gives the board a link anyone can read it by; the same link while it stays shared. */
  share: (id: string) => Promise<void>;
  unshare: (id: string) => Promise<void>;
  /** A file to upload, an https link, or null for none; the one before goes. */
  setPicture: (id: string, picture: File | string | null) => Promise<void>;
  /** What to show for a board's `image`; undefined while a file's signed URL is on its way. */
  pictureSrc: (image: string | null) => string | undefined;
  /** Marks a board changed now, as the database does when one of its rows changes. */
  touch: (id: string) => void;
};

const unavailable = () => Promise.reject(new Error("Not signed in."));
const BoardsContext = createContext<Boards>({
  boards: undefined,
  local: false,
  reload: () => Promise.resolve(),
  create: unavailable,
  update: unavailable,
  remove: unavailable,
  share: unavailable,
  unshare: unavailable,
  setPicture: unavailable,
  pictureSrc: () => undefined,
  touch: () => undefined,
});

/** A row as the app can trust it: an agent may have written columns the app cannot show, and a row from before a migration may lack a field. */
export const fromRow = (row: unknown): Board => {
  const board = row as Board;
  return { ...board, description: board.description ?? "", columns: readColumns(board.columns) };
};

const byPinnedThenRecent = (a: Board, b: Board) =>
  Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at);

type Result = { data: unknown; error: { message: string } | null };

const RESIGN_EVERY_MS = 5 * 60_000;

export const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function BoardsProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const owner = session?.user.id;
  // Signed out: the example boards, kept in memory, so a visitor sees and tries the real thing.
  const local = session === null;
  const [boards, setBoards] = useState<Board[]>();
  // A file's signed URL, kept through re-signing so a picture never blinks out; `at` says when it was last minted.
  const [signed, setSigned] = useState<Record<string, { url?: string; at: number }>>({});
  const signedNow = useRef(signed);
  signedNow.current = signed;
  // Re-signing runs on boards changes and on a timer, so an idle tab's pictures outlive their URLs.
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string>();
  const pending = useRef(new Map<string, Promise<unknown>>());
  // A response from before a sign-out must not land on the next screen.
  const current = useRef(owner);
  current.current = owner;

  const reload = useCallback(async () => {
    if (!owner || !supabase) return;
    const { data, error } = await supabase.from("boards").select("*");
    if (current.current !== owner) return;
    if (error) return setError(error.message);
    setError(undefined);
    setBoards(data.map(fromRow).sort(byPinnedThenRecent));
  }, [owner]);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), RESIGN_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  // Files are signed in one request per batch of paths that are new or ageing; links need nothing.
  useEffect(() => {
    if (local || !boards) return;
    const now = Date.now();
    const stale = now - (SIGNED_URL_SECONDS * 1000) / 2;
    const known = signedNow.current;
    const paths = [
      ...new Set(boards.flatMap((b) => (b.image && !isImageLink(b.image) ? [b.image] : []))),
    ];
    const missing = paths.filter((p) => !known[p] || known[p].at < stale);
    if (missing.length === 0 && Object.keys(known).every((p) => paths.includes(p))) return;
    // A failed batch is dated 0: tried again on the next run, not at once.
    const mark = (urls: Record<string, string>, at: number) =>
      setSigned((s) =>
        Object.fromEntries(
          paths.map((p) => [p, missing.includes(p) ? { url: urls[p] ?? s[p]?.url, at } : s[p]]),
        ),
      );
    mark({}, now);
    if (missing.length === 0) return;
    void signImages(missing).then(
      (urls) => current.current === owner && mark(urls, now),
      () => current.current === owner && mark({}, 0),
    );
  }, [boards, local, owner, tick]);

  useEffect(() => {
    if (local) return setBoards(demoBoards());
    setBoards(undefined);
    if (owner) void reload();
  }, [local, owner, reload]);

  useReloadOnReturn(reload);

  const put = (row: unknown) => {
    const board = fromRow(row);
    setBoards((list) =>
      [board, ...(list ?? []).filter((b) => b.id !== board.id)].sort(byPinnedThenRecent),
    );
    return board;
  };

  const create = async (input: BoardInput) => {
    if (local) {
      const board = demoBoard(input);
      put(board);
      return board;
    }
    const { data, error } = await supabase!.from("boards").insert(input).select().single();
    fail(error);
    return put(data);
  };

  // Requests to one board land in order, each waiting for the one before it; the last one's row is what shows.
  const inTurn = async (id: string, request: () => PromiseLike<Result>) => {
    const previous = pending.current.get(id) ?? Promise.resolve();
    const turn = previous.catch(() => undefined).then(request);
    pending.current.set(id, turn);
    try {
      const { data, error } = await turn;
      fail(error);
      if (!data) throw new Error("No such board.");
      if (pending.current.get(id) === turn && current.current === owner) put(data);
    } finally {
      if (pending.current.get(id) === turn) pending.current.delete(id);
    }
  };

  const update = async (id: string, input: BoardInput) => {
    if (local) {
      const updated_at = new Date().toISOString();
      return setBoards((list) =>
        list
          ?.map((b) => (b.id === id ? { ...b, ...input, updated_at } : b))
          .sort(byPinnedThenRecent),
      );
    }
    // Shown at once: a ticked box must not wait for the round trip.
    setBoards((list) => list?.map((b) => (b.id === id ? { ...b, ...input } : b)));
    try {
      await inTurn(id, () =>
        supabase!.from("boards").update(input).eq("id", id).select().maybeSingle(),
      );
    } catch (e) {
      void reload();
      throw e;
    }
  };

  const remove = async (id: string) => {
    const image = boards?.find((b) => b.id === id)?.image;
    if (!local) {
      const { error } = await supabase!.from("boards").delete().eq("id", id);
      fail(error);
      if (image && !isImageLink(image)) void removeImage(image);
    }
    setBoards((list) => list?.filter((b) => b.id !== id));
  };

  const setSharing = (fn: "share_board" | "unshare_board") => (id: string) =>
    local ? unavailable() : inTurn(id, () => supabase!.rpc(fn, { board_id: id }).maybeSingle());
  const share = setSharing("share_board");
  const unshare = setSharing("unshare_board");

  const setPicture = async (id: string, picture: File | string | null) => {
    const before = boards?.find((b) => b.id === id)?.image ?? null;
    if (picture instanceof File && local) return unavailable();
    const image = picture instanceof File ? await uploadImage(owner!, picture) : picture;
    try {
      await update(id, { image });
    } catch (e) {
      if (picture instanceof File) void removeImage(image!);
      throw e;
    }
    if (before && !isImageLink(before) && !local) void removeImage(before);
  };

  const pictureSrc = (image: string | null) =>
    image === null ? undefined : isImageLink(image) ? image : signed[image]?.url;

  const touch = (id: string) => {
    const updated_at = new Date().toISOString();
    setBoards((list) =>
      list?.map((b) => (b.id === id ? { ...b, updated_at } : b)).sort(byPinnedThenRecent),
    );
  };

  return (
    <BoardsContext
      value={{
        boards,
        local,
        error,
        reload,
        create,
        update,
        remove,
        share,
        unshare,
        setPicture,
        pictureSrc,
        touch,
      }}
    >
      {children}
    </BoardsContext>
  );
}

export const useBoards = () => useContext(BoardsContext);
