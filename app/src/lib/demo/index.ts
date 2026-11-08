import type { Board, BoardInput, Row } from "@shared/tables.ts";
import { exampleBoards } from "./boards.ts";

const files = import.meta.glob<string>("./*.{md,html}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const HOUR = 60 * 60 * 1000;

// Plain http beyond localhost has no randomUUID.
export const newId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

/** A visitor's board: made here, kept until the page reloads. */
export const demoBoard = (input: BoardInput, at = Date.now(), id: string = newId()): Board => ({
  id,
  title: input.title ?? "",
  kind: input.kind ?? "markdown",
  content: input.content ?? "",
  columns: input.columns ?? [],
  tags: input.tags ?? [],
  pinned: input.pinned ?? false,
  archived_at: input.archived_at ?? null,
  share_token: null,
  image: input.image ?? null,
  created_at: new Date(at).toISOString(),
  updated_at: new Date(at).toISOString(),
});

const exampleId = (i: number) => `example-${i + 1}`;

export const demoBoards = (): Board[] =>
  exampleBoards((name) => files[`./${name}`]).map((board, i) =>
    demoBoard(board, Date.now() - (i + 1) * HOUR, exampleId(i)),
  );

/** An example table's rows, made fresh; none for any other board. */
export const demoRows = (boardId: string): Row[] => {
  const examples = exampleBoards(() => "");
  const i = examples.findIndex((_, i) => exampleId(i) === boardId);
  const rows = examples[i]?.rows ?? [];
  const at = Date.now() - (i + 1) * HOUR;
  return rows.map((data, n) => {
    const stamp = new Date(at - (rows.length - n) * HOUR).toISOString();
    return {
      id: `${boardId}-${n + 1}`,
      board_id: boardId,
      data,
      created_at: stamp,
      updated_at: stamp,
    };
  });
};
