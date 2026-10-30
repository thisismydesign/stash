import type { Board } from "@shared/tables.ts";
import { summarize } from "./todo.ts";

const MAX = 140;

const clip = (text: string) => (text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text);

/** The first lines of Markdown as plain text, joined with dots. A leading H1 repeats the title, so it goes. */
export function excerpt(markdown: string): string {
  const lines = markdown
    .replace(/^\s*# .*\n?/, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^#+\s*/, "")
        .replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, "")
        .replace(/^\s*\d+[.)]\s+/, "")
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`>]/g, "")
        .trim(),
    )
    .filter(Boolean);
  return clip(lines.join(" · "));
}

/** The document's visible text, without its head, styles and scripts, or the H1 that repeats the title. */
export function htmlExcerpt(html: string): string {
  const text = html
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<h1[\s\S]*?<\/h1>/i, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clip(text);
}

export type Preview = { text: string; open?: string[]; done?: number };

export function preview(board: Board): Preview {
  if (board.kind === "html") return { text: htmlExcerpt(board.content) };
  if (board.kind === "markdown") return { text: excerpt(board.content) };
  const { open, done } = summarize(board.content);
  const text = open.length
    ? `${open.length} open${done ? `, ${done} done` : ""}`
    : done
      ? "All done"
      : "Empty";
  return { text, open: open.slice(0, 3).map(excerpt), done };
}
