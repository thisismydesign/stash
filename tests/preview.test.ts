import assert from "node:assert/strict";
import { test } from "node:test";
import { excerpt, htmlExcerpt } from "../app/src/lib/preview.ts";

test("excerpt drops the H1 that repeats the title and flattens the rest", () => {
  assert.equal(
    excerpt("# Trip\n\nSix weeks.\n\n## Route\n\n1. **Bangkok**"),
    "Six weeks. · Route · Bangkok",
  );
});

test("excerpt keeps a lower heading when the board has no H1", () => {
  assert.equal(excerpt("## Ideas\n\n- Lake"), "Ideas · Lake");
});

test("htmlExcerpt skips the head, scripts and the first H1", () => {
  const html =
    "<!doctype html><html><head><title>Cars</title><style>b{}</style></head><body><h1>Cars</h1><p>One car.</p><script>1</script></body></html>";
  assert.equal(htmlExcerpt(html), "One car.");
});
