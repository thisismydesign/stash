import { DONE_HEADING } from "../../../shared/tables.ts";

// Mirrors the conventions in supabase/functions/stash/agent.ts.

const TASK = /^(\s*)([-*+]) \[([ xX])\] (.*)$/;
const INDENTED = /^\s+\S/;

/** Agents may write CRLF; the app keeps LF. */
const split = (markdown: string) => markdown.replace(/\r\n?/g, "\n").split("\n");

export const isTask = (line: string) => TASK.test(line);
export const isChecked = (line: string) => /^\s*[-*+] \[[xX]\]/.test(line);
const isDoneHeading = (line: string) => line.trim().toLowerCase() === DONE_HEADING.toLowerCase();

/** Flips the task on the 1-based `line`; anything else is returned as is. */
export function toggleTask(markdown: string, line: number): string {
  const lines = split(markdown);
  const match = TASK.exec(lines[line - 1] ?? "");
  if (!match) return markdown;
  const [, indent, bullet, mark, rest] = match;
  lines[line - 1] = `${indent}${bullet} [${mark === " " ? "x" : " "}] ${rest}`;
  return lines.join("\n");
}

type Item = { lines: string[]; checked: boolean };

/** Top-level task items with their indented children; every other line stays as a plain line. */
function items(lines: string[]): (Item | string)[] {
  const out: (Item | string)[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = TASK.exec(lines[i]);
    if (!match || match[1] !== "") {
      out.push(lines[i]);
      continue;
    }
    const block = [lines[i]];
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      const blankBeforeChild = next.trim() === "" && INDENTED.test(lines[i + 2] ?? "");
      if (!INDENTED.test(next) && !blankBeforeChild) break;
      block.push(next);
      i++;
    }
    out.push({ lines: block, checked: match[3] !== " " });
  }
  return out;
}

const trimBlank = (lines: string[]) => {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  return lines.slice(start, end);
};

/** Ticked top-level items go under `## Done`, newest first; unticked ones come back to the end of the open list. */
export function settle(markdown: string): string {
  const lines = split(markdown);
  const heading = lines.findIndex(isDoneHeading);
  const open = items(heading === -1 ? lines : lines.slice(0, heading));
  const done = items(heading === -1 ? [] : lines.slice(heading + 1));
  const toDone = open.filter((p): p is Item => typeof p !== "string" && p.checked);
  const toOpen = done.filter((p): p is Item => typeof p !== "string" && !p.checked);
  if (!toDone.length && !toOpen.length) return markdown;

  const flat = (parts: (Item | string)[]) =>
    parts.flatMap((p) => (typeof p === "string" ? [p] : p.lines));
  const openLines = [
    ...trimBlank(flat(open.filter((p) => typeof p === "string" || !p.checked))),
    ...flat(toOpen),
  ];
  const doneLines = [
    ...flat(toDone),
    ...trimBlank(flat(done.filter((p) => typeof p === "string" || p.checked))),
  ];
  const result = [...openLines, "", DONE_HEADING, "", ...doneLines];
  return result.join("\n") + (markdown.endsWith("\n") ? "\n" : "");
}

/** What the list shows for a todo board. */
export function summarize(markdown: string): { open: string[]; done: number } {
  const lines = split(markdown);
  const heading = lines.findIndex(isDoneHeading);
  const openPart = heading === -1 ? lines : lines.slice(0, heading);
  const open = openPart
    .map((line) => TASK.exec(line))
    .filter((m): m is RegExpExecArray => m !== null && m[1] === "" && m[3] === " ")
    .map((m) => m[4]);
  return { open, done: lines.filter(isChecked).length };
}
