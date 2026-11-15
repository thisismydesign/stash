import { DONE_HEADING } from "../../../shared/tables.ts";

// Mirrors the conventions in supabase/functions/stash/agent.ts.

const TASK = /^(\s*)([-*+]) \[([ xX])\] (.*)$/;
const INDENTED = /^\s+\S/;
const TAB = /^#[ \t]+(\S.*)$/;
/** A done tab's heading. Strikethrough, not `[x]`: the formatted editor keeps it and shows it struck. */
const STRUCK = /^~~(.+)~~$/;
/** The title inside a heading struck as a whole; a heading struck only in part is an open tab. */
const struck = (title: string) => {
  const inner = STRUCK.exec(title)?.[1];
  return inner?.includes("~~") ? undefined : inner;
};
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

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

/** Marks the tab whose heading is on the 1-based `line` done, or open again; anything else is returned as is. */
export function toggleTab(markdown: string, line: number): string {
  const lines = split(markdown);
  const title = TAB.exec(lines[line - 1] ?? "")?.[1].trim();
  if (!title) return markdown;
  lines[line - 1] = `# ${struck(title) ?? `~~${title.replaceAll("~~", "")}~~`}`;
  return lines.join("\n");
}

type Section = { heading?: string; title: string; done: boolean; line: number; lines: string[] };

/** The fence open after `line`, given the one open before it: a closer is at least as long, with nothing after it. */
function fenceAfter(line: string, open: string | undefined): string | undefined {
  const [, mark, rest] = FENCE.exec(line) ?? [];
  if (!mark) return open;
  if (!open) return mark[0] === "`" && rest.includes("`") ? undefined : mark;
  const closes = mark[0] === open[0] && mark.length >= open.length && rest.trim() === "";
  return closes ? undefined : open;
}

/** The lines before the first tab, then each tab's. A `#` inside a code fence is a comment, not a tab. */
function sections(lines: string[]): Section[] {
  const out: Section[] = [{ title: "", done: false, line: 0, lines: [] }];
  let fence: string | undefined;
  lines.forEach((line, i) => {
    fence = fenceAfter(line, fence);
    const title = fence ? undefined : TAB.exec(line)?.[1].trim();
    if (!title) return out.at(-1)!.lines.push(line);
    const inner = struck(title);
    out.push({ heading: line, title: inner ?? title, done: !!inner, line: i + 1, lines: [] });
  });
  return out;
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

/** One list with its ticked items under `## Done`; undefined when none has to move. */
function settleItems(lines: string[]): string[] | undefined {
  const heading = lines.findIndex(isDoneHeading);
  const open = items(heading === -1 ? lines : lines.slice(0, heading));
  const done = items(heading === -1 ? [] : lines.slice(heading + 1));
  const toDone = open.filter((p): p is Item => typeof p !== "string" && p.checked);
  const toOpen = done.filter((p): p is Item => typeof p !== "string" && !p.checked);
  if (!toDone.length && !toOpen.length) return undefined;

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
  return [...openLines, "", DONE_HEADING, "", ...doneLines];
}

/**
 * Ticked top-level items go under `## Done`, newest first; unticked ones come back to the end of the open list.
 * Each tab is a list of its own, and done tabs go after the open ones, newest first.
 */
export function settle(markdown: string): string {
  const [intro, ...tabs] = sections(split(markdown)).map((section) => ({
    ...section,
    settled: settleItems(section.lines),
  }));
  const ordered = [...tabs.filter((t) => !t.done), ...tabs.filter((t) => t.done)];
  if (!intro.settled && tabs.every((t, i) => !t.settled && t === ordered[i])) return markdown;

  const blocks = [intro, ...ordered].map((section) => {
    const body = trimBlank(section.settled ?? section.lines);
    if (section.heading === undefined) return body;
    return body.length ? [section.heading, "", ...body] : [section.heading];
  });
  const text = blocks.filter((block) => block.length > 0).map((block) => block.join("\n"));
  return text.join("\n\n") + (markdown.endsWith("\n") ? "\n" : "");
}

/** A new, empty tab after the open ones. */
export function addTab(markdown: string, title: string): string {
  const text = split(markdown).join("\n").trimEnd();
  return settle(`${text}${text && "\n\n"}# ${title.replace(/\s+/g, " ").trim()}\n`);
}

const openTasks = (lines: string[]) => {
  const heading = lines.findIndex(isDoneHeading);
  return (heading === -1 ? lines : lines.slice(0, heading))
    .map((line) => TASK.exec(line))
    .filter((m): m is RegExpExecArray => m !== null && m[1] === "" && m[3] === " ")
    .map((m) => m[4]);
};

/** `line` is the heading's, 1-based; `body` starts on the next. `open` counts the top-level tasks left. */
export type Tab = { title: string; done: boolean; body: string; line: number; open: number };

/** A todo board as shown: what precedes the first tab, then the tabs in the order written. */
export function tabs(markdown: string): { intro: string; tabs: Tab[] } {
  const [intro, ...rest] = sections(split(markdown));
  return {
    intro: intro.lines.join("\n"),
    tabs: rest.map(({ title, done, line, lines }) => ({
      title,
      done,
      line,
      body: lines.join("\n"),
      open: openTasks(lines).length,
    })),
  };
}

/** What the list shows for a todo board. A done tab counts as one done thing, whatever is left in it. */
export function summarize(markdown: string): { open: string[]; done: number } {
  const all = sections(split(markdown));
  return {
    open: all.filter((s) => !s.done).flatMap((s) => openTasks(s.lines)),
    done: all.reduce((n, s) => n + (s.done ? 1 : s.lines.filter(isChecked).length), 0),
  };
}
