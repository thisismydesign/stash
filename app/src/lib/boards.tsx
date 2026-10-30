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
import { supabase, useSession } from "./supabase.ts";

type Boards = {
  /** Undefined while loading. */
  boards: Board[] | undefined;
  error?: string;
  reload: () => Promise<void>;
  create: (input: BoardInput) => Promise<Board>;
  update: (id: string, input: BoardInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const unavailable = () => Promise.reject(new Error("Not signed in."));
const BoardsContext = createContext<Boards>({
  boards: undefined,
  reload: () => Promise.resolve(),
  create: unavailable,
  update: unavailable,
  remove: unavailable,
});

const byPinnedThenRecent = (a: Board, b: Board) =>
  Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at);

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function BoardsProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const owner = session?.user.id;
  const [boards, setBoards] = useState<Board[]>();
  const [error, setError] = useState<string>();
  const pending = useRef(new Map<string, Promise<unknown>>());

  const reload = useCallback(async () => {
    if (!owner || !supabase) return;
    const { data, error } = await supabase.from("boards").select("*");
    if (error) return setError(error.message);
    setError(undefined);
    setBoards((data as Board[]).sort(byPinnedThenRecent));
  }, [owner]);

  useEffect(() => {
    if (!owner) {
      setBoards(undefined);
      return;
    }
    void reload();
  }, [owner, reload]);

  // An agent may have edited boards while the tab sat in the background.
  useEffect(() => {
    const onReturn = () => !document.hidden && void reload();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [reload]);

  const put = (board: Board) =>
    setBoards((list) =>
      [board, ...(list ?? []).filter((b) => b.id !== board.id)].sort(byPinnedThenRecent),
    );

  const create = async (input: BoardInput) => {
    const { data, error } = await supabase!.from("boards").insert(input).select().single();
    fail(error);
    put(data as Board);
    return data as Board;
  };

  const update = async (id: string, input: BoardInput) => {
    // Shown at once: a ticked box must not wait for the round trip.
    setBoards((list) => list?.map((b) => (b.id === id ? { ...b, ...input } : b)));
    // Partial patches to one board must land in order, so each waits for the one before it.
    const previous = pending.current.get(id) ?? Promise.resolve();
    const turn = previous
      .catch(() => undefined)
      .then(() => supabase!.from("boards").update(input).eq("id", id).select().single());
    pending.current.set(id, turn);
    try {
      const { data, error } = await turn;
      if (error) {
        void reload();
        throw new Error(error.message);
      }
      // A later patch is still showing optimistically; its own response brings the full row.
      if (pending.current.get(id) === turn) put(data as Board);
    } finally {
      if (pending.current.get(id) === turn) pending.current.delete(id);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase!.from("boards").delete().eq("id", id);
    fail(error);
    setBoards((list) => list?.filter((b) => b.id !== id));
  };

  return (
    <BoardsContext value={{ boards, error, reload, create, update, remove }}>
      {children}
    </BoardsContext>
  );
}

export const useBoards = () => useContext(BoardsContext);
