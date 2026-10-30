import { Typography } from "@mantine/core";
import { createContext, useContext, type ComponentProps } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import "./markdown.css";

type Toggle = (line: number) => void;

const ToggleContext = createContext<Toggle | undefined>(undefined);
/** The source line of the task item being rendered, for the checkbox inside it. */
const TaskLine = createContext<number | undefined>(undefined);

// The hast node is for the component, not the DOM element.
function dom<P extends ExtraProps>(props: P): Omit<P, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

function ListItem(props: ComponentProps<"li"> & ExtraProps) {
  const { node, className, children } = props;
  const line = className?.includes("task-list-item") ? node?.position?.start.line : undefined;
  return (
    <TaskLine value={line}>
      <li {...dom(props)}>{children}</li>
    </TaskLine>
  );
}

function Input(props: ComponentProps<"input"> & ExtraProps) {
  const line = useContext(TaskLine);
  const toggle = useContext(ToggleContext);
  if (props.type !== "checkbox" || line === undefined || !toggle) return <input {...dom(props)} />;
  return (
    <input
      type="checkbox"
      checked={Boolean(props.checked)}
      aria-label={props.checked ? "Done" : "To do"}
      onChange={() => toggle(line)}
    />
  );
}

function Link(props: ComponentProps<"a"> & ExtraProps) {
  return <a {...dom(props)} target="_blank" rel="noopener noreferrer" />;
}

const components: Components = { li: ListItem, input: Input, a: Link };

/** Renders GitHub-flavoured Markdown; with `onToggle`, task boxes are live and report their source line. */
export function Markdown({ children, onToggle }: { children: string; onToggle?: Toggle }) {
  return (
    <ToggleContext value={onToggle}>
      <Typography className="markdown" fz="sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {children}
        </ReactMarkdown>
      </Typography>
    </ToggleContext>
  );
}
