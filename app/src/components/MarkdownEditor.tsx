import { Text } from "@mantine/core";
import { Link, RichTextEditor, getTaskListExtension } from "@mantine/tiptap";
import { Extension, type Editor } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { Plugin } from "@tiptap/pm/state";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";

import "@mantine/tiptap/styles.css";
import "./markdown.css";

/** Plain text pasted is read as Markdown, so notes copied from a chat arrive formatted. */
function pasteMarkdown(editor: Editor, event: ClipboardEvent): boolean {
  const data = event.clipboardData;
  if (!data || data.types.includes("text/html") || editor.isActive("codeBlock")) return false;
  const text = data.getData("text/plain");
  if (!text) return false;
  editor.commands.insertContent(text, { contentType: "markdown" });
  return true;
}

/** The document always ends in an empty paragraph, which is not part of the board. */
function markdownOf(editor: Editor): string {
  const text = editor.getMarkdown().trimEnd();
  return text && `${text}\n`;
}

const PasteMarkdown = Extension.create({
  name: "pasteMarkdown",
  addProseMirrorPlugins() {
    const { editor } = this;
    return [new Plugin({ props: { handlePaste: (_view, event) => pasteMarkdown(editor, event) } })];
  },
});

const extensions = [
  StarterKit.configure({ link: false }),
  Link,
  getTaskListExtension(TaskList),
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  Image,
  Markdown,
  PasteMarkdown,
  Placeholder.configure({ placeholder: "Write anything." }),
];

/** Markdown, shown rendered and edited in place; `onChange` gets the source after each edit. */
export function MarkdownEditor({
  initial,
  onChange,
}: {
  initial: string;
  onChange: (markdown: string) => void;
}) {
  const [content] = useState(initial);
  // Raw HTML, footnotes and the like have no formatted form: what comes back out is not what went in.
  const [rewrites, setRewrites] = useState(false);
  const editor = useEditor({
    extensions,
    content,
    contentType: "markdown",
    autofocus: "end",
    editorProps: { attributes: { "aria-label": "Content" } },
    onCreate: ({ editor }) => setRewrites(markdownOf(editor).trimEnd() !== content.trimEnd()),
    onUpdate: ({ editor }) => onChange(markdownOf(editor)),
  });
  return (
    <RichTextEditor editor={editor} variant="subtle">
      {rewrites && (
        <Text size="xs" c="dimmed" px="md" pt="xs">
          Some of this Markdown has no formatted form. Saving from here rewrites it; Source keeps it
          as is.
        </Text>
      )}
      <RichTextEditor.Toolbar sticky stickyOffset="var(--app-shell-header-height)">
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.Code />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.H1 />
          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
          <RichTextEditor.TaskList />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Blockquote />
          <RichTextEditor.CodeBlock />
          <RichTextEditor.Hr />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Undo />
          <RichTextEditor.Redo />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>
      <RichTextEditor.Content className="markdown" fz="sm" />
    </RichTextEditor>
  );
}
