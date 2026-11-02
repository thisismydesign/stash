// Relative imports only: tests run this under Node.

import type { BoardKind } from "../../../../shared/tables.ts";

export type Template = {
  id: string;
  name: string;
  description: string;
  kind: BoardKind;
  /** Starts from `<id>.html` beside this module; otherwise empty, so the editor opens. */
  document: boolean;
};

/** In the order offered; the first is preselected. */
export const TEMPLATES = [
  {
    id: "blank",
    name: "Blank",
    description: "An empty page to write on.",
    kind: "html",
    document: false,
  },
  {
    id: "todo",
    name: "To-do",
    description: "Tasks to tick; done ones move down.",
    kind: "todo",
    document: false,
  },
  {
    id: "mood-board",
    name: "Mood board",
    description: "Pictures and colours.",
    kind: "html",
    document: true,
  },
  {
    id: "comparison",
    name: "Comparison",
    description: "Options side by side.",
    kind: "html",
    document: true,
  },
  {
    id: "recipe",
    name: "Recipe",
    description: "Ingredients and steps.",
    kind: "html",
    document: true,
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "What happens when.",
    kind: "html",
    document: true,
  },
] as const satisfies readonly Template[];
export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const templateById = (id: TemplateId): Template => TEMPLATES.find((t) => t.id === id)!;

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const templateContent = (
  file: (name: string) => string | undefined,
  id: TemplateId,
  title: string,
): string => {
  if (!templateById(id).document) return "";
  const html = file(`${id}.html`);
  if (html === undefined) throw new Error(`No document for the ${id} template`);
  const escaped = escape(title);
  return html.replaceAll("{{title}}", () => escaped);
};
