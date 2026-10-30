import { createTheme, type CSSVariablesResolver } from "@mantine/core";
import type { BoardKind } from "@shared/tables.ts";

export const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace",
});

export const KIND_COLOR: Record<BoardKind, string> = {
  todo: "green",
  markdown: "blue",
  html: "orange",
};

export const KIND_LABEL: Record<BoardKind, string> = {
  todo: "To-do",
  markdown: "Markdown",
  html: "HTML",
};

/** Mantine's defaults read faint on dark backgrounds. */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { "--mantine-color-dimmed": "var(--mantine-color-gray-7)" },
  dark: {
    "--mantine-color-text": "var(--mantine-color-gray-2)",
    "--mantine-color-dimmed": "var(--mantine-color-dark-1)",
  },
});

// One per tag, by its place in alphabetical order, so a tag looks the same everywhere.
const TAG_COLORS = ["teal", "blue", "orange", "cyan", "pink", "lime", "yellow", "grape"] as const;

export function tagColors(tags: string[]): (tag: string) => string {
  const index = new Map(tags.map((t, i) => [t, i]));
  return (tag) => {
    const i = index.get(tag);
    return i === undefined ? "gray" : TAG_COLORS[i % TAG_COLORS.length];
  };
}
