import type { Board, BoardInput } from "@shared/tables.ts";
import { exampleBoards } from "./boards.ts";

const files = import.meta.glob<string>("./*.{md,html}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const HOUR = 60 * 60 * 1000;

// Plain http beyond localhost has no randomUUID.
const newId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

/** A visitor's board: made here, kept until the page reloads. */
export const demoBoard = (input: BoardInput, at = Date.now(), id: string = newId()): Board => ({
  id,
  title: input.title ?? "",
  kind: input.kind ?? "markdown",
  content: input.content ?? "",
  tags: input.tags ?? [],
  pinned: input.pinned ?? false,
  archived_at: input.archived_at ?? null,
  created_at: new Date(at).toISOString(),
  updated_at: new Date(at).toISOString(),
});

export const demoBoards = (): Board[] =>
  exampleBoards((name) => files[`./${name}`]).map((board, i) =>
    demoBoard(board, Date.now() - (i + 1) * HOUR, `example-${i + 1}`),
  );
