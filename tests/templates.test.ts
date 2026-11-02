import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { htmlExcerpt } from "../app/src/lib/preview.ts";
import { TEMPLATES, templateContent } from "../app/src/lib/templates/templates.ts";

const dir = new URL("../app/src/lib/templates/", import.meta.url);
const file = (name: string) => {
  const url = new URL(name, dir);
  return existsSync(url) ? readFileSync(url, "utf8") : undefined;
};

test("blank and to-do start empty, so the editor opens", () => {
  assert.equal(templateContent(file, "blank", "Notes"), "");
  assert.equal(templateContent(file, "todo", "Errands"), "");
});

test("every page template has a whole document that reads in either theme", () => {
  for (const t of TEMPLATES.filter((t) => t.document)) {
    const html = templateContent(file, t.id, "Kitchen");
    assert.match(html, /^<!doctype html>/i, t.id);
    assert.match(html, /color-scheme: light dark/, t.id);
    assert.match(html, /name="viewport"/, t.id);
    assert.ok(html.includes("<title>Kitchen</title>"), t.id);
    assert.ok(html.includes("<h1>Kitchen</h1>"), t.id);
    assert.ok(!html.includes("{{"), t.id);
    assert.ok(htmlExcerpt(html).length > 20, t.id);
  }
});

test("a missing document is an error, not an empty page", () => {
  assert.throws(() => templateContent(() => undefined, "recipe", "Soup"), /recipe/);
});

test("the title goes in as text, whatever it holds", () => {
  const html = templateContent(file, "recipe", `Tom & Jerry's <soup> $' $&`);
  assert.ok(html.includes("<h1>Tom &#38; Jerry&#39;s &#60;soup&#62; $&#39; $&#38;</h1>"));
});
