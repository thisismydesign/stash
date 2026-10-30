// Rows the app reads straight from the database; the migrations define them.

/**
 * Each kind has a renderer:
 * todo     — a Markdown task list; ticked items move under `## Done`
 * markdown — rendered Markdown
 * html     — a document, rendered in a sandbox
 * Mirrored by the check constraint on `boards.kind`.
 */
export const BOARD_KINDS = ["todo", "markdown", "html"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];
export const isBoardKind = (v: string): v is BoardKind =>
  (BOARD_KINDS as readonly string[]).includes(v);

export interface Board {
  id: string;
  title: string;
  kind: BoardKind;
  content: string;
  tags: string[];
  pinned: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What a caller sends to make or change a board; the database fills the rest. */
export type BoardInput = Partial<
  Pick<Board, "title" | "kind" | "content" | "tags" | "pinned" | "archived_at">
>;

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
