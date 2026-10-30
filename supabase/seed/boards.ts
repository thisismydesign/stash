// The example boards the dev account starts with: one of each kind. Every row names every column, as one insert sends them together.

import { readFileSync } from "node:fs";
import type { BoardInput } from "../../shared/tables.ts";

const file = (name: string) => readFileSync(new URL(`./boards/${name}`, import.meta.url), "utf8");

/** In display order: the sort is pinned first, then most recently updated, and the seed inserts them last to first. */
export const exampleBoards = (): BoardInput[] => [
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
