import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Board, BoardInput } from "@shared/tables.ts";
import { demoBoard, demoBoards } from "./demo/index.ts";
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
});

const byPinnedThenRecent = (a: Board, b: Board) =>
  Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at);

type Result = { data: unknown; error: { message: string } | null };

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function BoardsProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const owner = session?.user.id;
  // Signed out: the example boards, kept in memory, so a visitor sees and tries the real thing.
  const local = session === null;
  const [boards, setBoards] = useState<Board[]>();
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
    setBoards((data as Board[]).sort(byPinnedThenRecent));
  }, [owner]);

  useEffect(() => {
    if (local) return setBoards(demoBoards());
    setBoards(undefined);
    if (owner) void reload();
  }, [local, owner, reload]);

  useReloadOnReturn(reload);

  const put = (board: Board) =>
    setBoards((list) =>
      [board, ...(list ?? []).filter((b) => b.id !== board.id)].sort(byPinnedThenRecent),
    );

  const create = async (input: BoardInput) => {
    if (local) {
      const board = demoBoard(input);
      put(board);
      return board;
    }
    const { data, error } = await supabase!.from("boards").insert(input).select().single();
    fail(error);
    put(data as Board);
    return data as Board;
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
      if (pending.current.get(id) === turn && current.current === owner) put(data as Board);
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
    if (!local) {
      const { error } = await supabase!.from("boards").delete().eq("id", id);
      fail(error);
    }
    setBoards((list) => list?.filter((b) => b.id !== id));
  };

  const setSharing = (fn: "share_board" | "unshare_board") => (id: string) =>
    local ? unavailable() : inTurn(id, () => supabase!.rpc(fn, { board_id: id }).maybeSingle());
  const share = setSharing("share_board");
  const unshare = setSharing("unshare_board");

  return (
    <BoardsContext value={{ boards, local, error, reload, create, update, remove, share, unshare }}>
      {children}
    </BoardsContext>
  );
}

export const useBoards = () => useContext(BoardsContext);
