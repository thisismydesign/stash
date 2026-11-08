// Rows the app reads straight from the database; the migrations define them.

/**
 * Each kind has a renderer:
 * todo     — a Markdown task list; ticked items move under `## Done`
 * markdown — rendered Markdown
 * html     — a document, rendered in a sandbox
 * table    — typed `columns`; its rows are in `rows`, one `data` object each
 * Mirrored by the check constraint on `boards.kind`.
 */
export const BOARD_KINDS = ["todo", "markdown", "html", "table"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];
export const isBoardKind = (v: string): v is BoardKind =>
  (BOARD_KINDS as readonly string[]).includes(v);

export interface Board {
  id: string;
  title: string;
  kind: BoardKind;
  content: string;
  /** What a table's rows hold; `[]` for every other kind. */
  columns: Column[];
  tags: string[];
  pinned: boolean;
  archived_at: string | null;
  /** Set by `share_board`, cleared by `unshare_board`; anyone with it may read the board. */
  share_token: string | null;
  /** An https link, or the path of a file in the `images` bucket under the owner's folder. */
  image: string | null;
  created_at: string;
  updated_at: string;
}

/** What a caller sends to make or change a board; the database fills the rest. */
export type BoardInput = Partial<
  Pick<
    Board,
    "title" | "kind" | "content" | "columns" | "tags" | "pinned" | "archived_at" | "image"
  >
>;

/** What `shared_board(token)` returns: the board as its readers see it. */
export type SharedBoard = Pick<
  Board,
  "id" | "title" | "kind" | "content" | "columns" | "tags" | "image" | "updated_at"
>;

/**
 * What a table's cell holds, as JSON:
 * text     — a string
 * number   — a number; `decimals` fixes how many are shown
 * date     — "YYYY-MM-DD"
 * checkbox — true or false
 * select   — one of `options`
 * url      — an https or http link
 * Missing or null is empty. Not Postgres's own types: these carry what a cell means and how it reads.
 */
export const COLUMN_TYPES = ["text", "number", "date", "checkbox", "select", "url"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];
export const isColumnType = (v: string): v is ColumnType =>
  (COLUMN_TYPES as readonly string[]).includes(v);

export interface Column {
  /** Names the cell in a row's `data`; stays put when the column is renamed. */
  key: string;
  name: string;
  type: ColumnType;
  /** For `select`: what a cell may be. */
  options?: string[];
  /** For `number`: how many decimals a cell shows. */
  decimals?: number;
}

export type Cell = string | number | boolean | null;

/** A table's row: `data` is keyed by its board's column keys. */
export interface Row {
  id: string;
  board_id: string;
  data: Record<string, Cell>;
  created_at: string;
  updated_at: string;
}

export type RowInput = Pick<Row, "board_id" | "data">;

/** What `shared_rows(token)` returns. */
export type SharedRow = Pick<Row, "id" | "data" | "created_at" | "updated_at">;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The columns an agent or an older app wrote, as far as they are well-formed; the rest is dropped. */
export function readColumns(value: unknown): Column[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const columns: Column[] = [];
  for (const c of value) {
    if (!isObject(c) || typeof c.key !== "string" || c.key === "" || seen.has(c.key)) continue;
    if (typeof c.type !== "string" || !isColumnType(c.type)) continue;
    seen.add(c.key);
    const column: Column = {
      key: c.key,
      name: typeof c.name === "string" && c.name !== "" ? c.name : c.key,
      type: c.type,
    };
    if (column.type === "select")
      column.options = Array.isArray(c.options)
        ? c.options.filter((o): o is string => typeof o === "string")
        : [];
    if (column.type === "number" && typeof c.decimals === "number" && c.decimals >= 0)
      column.decimals = Math.min(10, Math.floor(c.decimals));
    columns.push(column);
  }
  return columns;
}

/** A key from a column's name, as an agent would write it: `Amount (EUR)` → `amount_eur`. */
export function columnKey(name: string, taken: readonly string[] = []): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "column";
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`;
  return key;
}

/** A link a cell may hold; anything else, such as `javascript:`, reads as text. */
export const isLink = (value: string) => /^https?:\/\//i.test(value);

/** The cell a column makes of what was typed or sent; null for nothing or nonsense. */
export function toCell(column: Column, value: unknown): Cell {
  if (typeof value === "string") value = value.trim();
  if (value === null || value === undefined || value === "") return null;
  switch (column.type) {
    case "checkbox":
      return value === true || value === "true" || value === 1;
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
    case "url":
      return isLink(String(value)) ? String(value) : null;
    default:
      return String(value);
  }
}

/** The private bucket pictures are uploaded to; its limits mirror the bucket row. */
export const IMAGE_BUCKET = "images";
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** A link is fetched as it is; anything else is a path in the bucket, served by signed URL. */
export const isImageLink = (image: string) => image.startsWith("https://");
/** Mirrors the check on `boards.image`. */
export const IMAGE_MAX_LENGTH = 2048;

/** The app's address for a shared board. */
export const shareLink = (site: string, token: string) => `${site.replace(/\/$/, "")}/s/${token}`;

/** The heading a todo board's ticked items collect under. */
export const DONE_HEADING = "## Done";

/** The hash never leaves the database. */
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
