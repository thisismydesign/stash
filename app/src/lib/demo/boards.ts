// The example boards: what a signed-out visitor sees, and what supabase/seed/dev-account.ts gives the account `pnpm run dev` signs in as. One of each kind, and a page from a template.
// Relative imports only: the seed script runs this under Node.

import type { Board, Cell, Column } from "../../../../shared/tables.ts";

export type ExampleBoard = Pick<Board, "title" | "kind" | "content" | "tags" | "pinned"> & {
  description?: string;
  columns?: Board["columns"];
  rows?: Record<string, Cell>[];
};

const TRANSACTION_COLUMNS: Column[] = [
  { key: "date", name: "Date", type: "date" },
  { key: "description", name: "Description", type: "text" },
  { key: "amount", name: "Amount", type: "number", decimals: 2 },
  { key: "currency", name: "Currency", type: "select", options: ["EUR", "HUF", "USD"] },
  {
    key: "category",
    name: "Category",
    type: "select",
    options: ["Income", "Software", "Hardware", "Office", "Travel", "Services", "Other"],
  },
  { key: "deductible", name: "Deductible", type: "checkbox" },
  { key: "receipt", name: "Receipt", type: "url" },
  { key: "notes", name: "Notes", type: "text" },
];

const transaction = (
  date: string,
  description: string,
  amount: number,
  currency: string,
  category: string,
  deductible: boolean,
  notes?: string,
): Record<string, Cell> => ({
  date,
  description,
  amount,
  currency,
  category,
  deductible,
  ...(notes ? { notes } : {}),
});

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
    title: "Transactions 2026",
    kind: "table",
    tags: ["money", "taxes"],
    pinned: false,
    content: "",
    description:
      "Every invoice and receipt of the year. Money out is **negative**; tick *Deductible* when the accountant may use it.",
    columns: TRANSACTION_COLUMNS,
    rows: [
      transaction("2026-01-05", "Domain renewal", -14.99, "EUR", "Software", true),
      transaction("2026-01-12", "Invoice 2026-01, Acme", 2400, "EUR", "Income", false),
      transaction(
        "2026-01-20",
        "Second monitor",
        -189000,
        "HUF",
        "Hardware",
        true,
        "Shared with home use",
      ),
      transaction("2026-02-03", "Train to Vienna, client visit", -58, "EUR", "Travel", true),
      transaction("2026-02-11", "Invoice 2026-02, Acme", 2400, "EUR", "Income", false),
      transaction("2026-02-14", "Accountant, January", -45000, "HUF", "Services", true),
      transaction("2026-03-01", "Design tool, yearly", -144, "USD", "Software", true),
      transaction("2026-03-09", "Invoice 2026-03, Birch & Co", 1800, "EUR", "Income", false),
      transaction("2026-03-15", "Printer paper and toner", -21900, "HUF", "Office", true),
    ],
  },
  {
    title: "To-do",
    kind: "todo",
    tags: ["home", "errands"],
    pinned: false,
    content: file("todo.md"),
  },
  {
    title: "Living room",
    kind: "html",
    tags: ["home", "ideas"],
    pinned: false,
    content: file("living-room.html"),
  },
  {
    title: "Car purchase",
    kind: "html",
    tags: ["buying", "cars"],
    pinned: false,
    content: file("car-purchase.html"),
  },
];
