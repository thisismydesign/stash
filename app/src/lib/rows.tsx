import { useCallback, useEffect, useRef, useState } from "react";
import type { Cell, Row, SharedRow } from "@shared/tables.ts";
import { fail, useBoards } from "./boards.tsx";
import { demoRows, newId } from "./demo/index.ts";
import { supabase } from "./supabase.ts";
import { useReloadOnReturn } from "./useReloadOnReturn.ts";

export type RowData = Record<string, Cell>;

export type RowEdits = {
  add: (data: RowData) => Promise<Row>;
  change: (id: string, data: RowData) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

type State = { rows?: Row[]; error?: string };

/** A visitor's rows, kept until the page reloads. */
const local = new Map<string, Row[]>();
const localRows = (boardId: string) => {
  if (!local.has(boardId)) local.set(boardId, demoRows(boardId));
  return local.get(boardId)!;
};

/** The rows of the owner's table, in the order they were added. */
export async function loadRows(boardId: string, offline: boolean): Promise<Row[]> {
  if (offline) return [...localRows(boardId)];
  const { data, error } = await supabase!
    .from("rows")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at");
  fail(error);
  return data as Row[];
}

/** The rows of the owner's table, in the order they were added; nothing while `boardId` is undefined. */
export function useRows(boardId: string | undefined): State & RowEdits {
  const { local: offline, touch } = useBoards();
  const [state, setState] = useState<State>({});
  // A response from before a change of board must not land on the next one.
  const current = useRef(boardId);
  current.current = boardId;

  const reload = useCallback(async () => {
    if (!boardId) return;
    try {
      const rows = await loadRows(boardId, offline);
      if (current.current === boardId) setState({ rows });
    } catch (e) {
      if (current.current === boardId) setState({ error: (e as Error).message });
    }
  }, [boardId, offline]);

  useEffect(() => {
    setState({});
    void reload();
  }, [reload]);
  useReloadOnReturn(reload);

  const set = (fn: (rows: Row[]) => Row[]) => {
    setState((s) => (s.rows ? { rows: fn(s.rows) } : s));
    if (boardId) touch(boardId);
  };

  const add = async (data: RowData) => {
    if (offline) {
      const at = new Date().toISOString();
      const row: Row = { id: newId(), board_id: boardId!, data, created_at: at, updated_at: at };
      localRows(boardId!).push(row);
      set((rows) => [...rows, row]);
      return row;
    }
    const { data: made, error } = await supabase!
      .from("rows")
      .insert({ board_id: boardId, data })
      .select()
      .single();
    fail(error);
    const row = made as Row;
    // A reload may have brought the row already.
    if (current.current === boardId) set((rows) => [...rows.filter((r) => r.id !== row.id), row]);
    return row;
  };

  const change = async (id: string, data: RowData) => {
    const updated_at = new Date().toISOString();
    const patch = (rows: Row[]) => rows.map((r) => (r.id === id ? { ...r, data, updated_at } : r));
    if (offline) {
      local.set(boardId!, patch(localRows(boardId!)));
      return set(patch);
    }
    // Shown at once; the row comes back on a failure.
    set(patch);
    const { data: saved, error } = await supabase!
      .from("rows")
      .update({ data })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error || !saved) {
      void reload();
      throw new Error(error?.message ?? "No such row.");
    }
  };

  const remove = async (id: string) => {
    if (!offline) {
      const { error } = await supabase!.from("rows").delete().eq("id", id);
      fail(error);
    } else
      local.set(
        boardId!,
        localRows(boardId!).filter((r) => r.id !== id),
      );
    set((rows) => rows.filter((r) => r.id !== id));
  };

  return { ...state, add, change, remove };
}

/** A shared table's rows, read-only; nothing while `token` is undefined. */
export function useSharedRows(token: string | undefined): { rows?: SharedRow[]; error?: string } {
  const [state, setState] = useState<{ rows?: SharedRow[]; error?: string }>({});
  // Only the latest request's answer may land.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const turn = ++latest.current;
    if (!token) return;
    const { data, error } = await supabase!.rpc("shared_rows", { token });
    if (turn !== latest.current) return;
    setState(error ? { error: error.message } : { rows: data as SharedRow[] });
  }, [token]);
  useEffect(() => {
    setState({});
    void load();
  }, [load]);
  useReloadOnReturn(load);
  return state;
}
