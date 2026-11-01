// The example boards: what a signed-out visitor sees, and what supabase/seed/dev-account.ts gives the account `pnpm run dev` signs in as. One of each kind.
// Relative imports only: the seed script runs this under Node.

import type { Board } from "../../../../shared/tables.ts";

export type ExampleBoard = Pick<Board, "title" | "kind" | "content" | "tags" | "pinned">;

/** In display order: pinned first, then most recently updated. `file` reads a sibling of this module. */
export const exampleBoards = (file: (name: string) => string): ExampleBoard[] => [
  {
    title: "Asia trip",
    kind: "markdown",
    tags: ["travel", "planning"],
    pinned: true,
    content: file("asia-trip.md"),
  },
  {
    title: "To-do",
    kind: "todo",
    tags: ["home", "errands"],
    pinned: false,
    content: file("todo.md"),
  },
  {
    title: "Car purchase",
    kind: "html",
    tags: ["buying", "cars"],
    pinned: false,
    content: file("car-purchase.html"),
  },
];
