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
  /** Set by `share_board`, cleared by `unshare_board`; anyone with it may read the board. */
  share_token: string | null;
  /** An https link, or the path of a file in the `images` bucket under the owner's folder. */
  image: string | null;
  created_at: string;
  updated_at: string;
}

/** What a caller sends to make or change a board; the database fills the rest. */
export type BoardInput = Partial<
  Pick<Board, "title" | "kind" | "content" | "tags" | "pinned" | "archived_at" | "image">
>;

/** What `shared_board(token)` returns: the board as its readers see it. */
export type SharedBoard = Pick<
  Board,
  "id" | "title" | "kind" | "content" | "tags" | "image" | "updated_at"
>;

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
