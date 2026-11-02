import type { BoardInput } from "@shared/tables.ts";
import { templateById, templateContent, type TemplateId } from "./templates.ts";

export { TEMPLATES, type Template, type TemplateId } from "./templates.ts";

const files = import.meta.glob<string>("./*.html", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The kind and content a new board gets from a template. */
export const fromTemplate = (
  id: TemplateId,
  title: string,
): Pick<BoardInput, "kind" | "content"> => ({
  kind: templateById(id).kind,
  content: templateContent((name) => files[`./${name}`], id, title),
});
