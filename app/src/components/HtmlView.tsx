// The document is the owner's, yet it stays off the app's origin: no session, no storage, no parent.
export function HtmlView({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      style={{
        width: "100%",
        flex: 1,
        minHeight: "70vh",
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-md)",
        background: "var(--mantine-color-body)",
      }}
    />
  );
}
