import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addTab, settle, summarize, tabs, toggleTab, toggleTask } from "../app/src/lib/todo.ts";

const list = `- [ ] Visa
- [ ] Pillow
- [ ] Bike
  - [ ] Helmet
  - [ ] Gloves
- [ ] Wallet
`;

describe("toggleTask", () => {
  it("ticks and unticks the task on the line", () => {
    const ticked = toggleTask(list, 2);
    assert.match(ticked.split("\n")[1], /^- \[x\] Pillow$/);
    assert.equal(toggleTask(ticked, 2), list);
  });
  it("ticks a nested task", () => {
    assert.match(toggleTask(list, 4).split("\n")[3], /^ {2}- \[x\] Helmet$/);
  });
  it("leaves other lines alone", () => {
    assert.equal(toggleTask("# Title\n- [ ] a", 1), "# Title\n- [ ] a");
    assert.equal(toggleTask(list, 99), list);
  });
});

describe("settle", () => {
  it("returns the text unchanged when nothing moves", () => {
    assert.equal(settle(list), list);
    assert.equal(settle(toggleTask(list, 4)), toggleTask(list, 4));
  });
  it("moves a ticked item with its children under Done", () => {
    assert.equal(
      settle(toggleTask(list, 3)),
      `- [ ] Visa
- [ ] Pillow
- [ ] Wallet

## Done

- [x] Bike
  - [ ] Helmet
  - [ ] Gloves
`,
    );
  });
  it("puts the newest done item first", () => {
    const once = settle(toggleTask(list, 2));
    const twice = settle(toggleTask(once, 1));
    assert.equal(
      twice,
      `- [ ] Bike
  - [ ] Helmet
  - [ ] Gloves
- [ ] Wallet

## Done

- [x] Visa
- [x] Pillow
`,
    );
  });
  it("brings an unticked item back to the end of the open list", () => {
    const done = settle(toggleTask(list, 2));
    const back = settle(toggleTask(done, done.split("\n").indexOf("- [x] Pillow") + 1));
    assert.equal(
      back,
      `- [ ] Visa
- [ ] Bike
  - [ ] Helmet
  - [ ] Gloves
- [ ] Wallet
- [ ] Pillow

## Done
`,
    );
  });
  it("keeps headings and plain lines where they are", () => {
    const grouped = `# Errands\n\nCall first.\n\n- [x] Bank\n- [ ] Post\n\n## Later\n\n- [ ] Dentist\n`;
    assert.equal(
      settle(grouped),
      `# Errands\n\nCall first.\n\n- [ ] Post\n\n## Later\n\n- [ ] Dentist\n\n## Done\n\n- [x] Bank\n`,
    );
  });
  it("recognises the heading in any case", () => {
    assert.equal(settle("- [ ] a\n\n## done\n\n- [x] b\n"), "- [ ] a\n\n## done\n\n- [x] b\n");
  });
});

describe("summarize", () => {
  it("counts top-level open items and every ticked one", () => {
    const text = settle(toggleTask(toggleTask(list, 4), 2));
    assert.deepEqual(summarize(text), { open: ["Visa", "Bike", "Wallet"], done: 2 });
  });
});

describe("CRLF content", () => {
  it("toggles and counts tasks an agent wrote with Windows line endings", () => {
    const crlf = "- [ ] Visa\r\n- [ ] Pillow\r\n";
    assert.equal(toggleTask(crlf, 2), "- [ ] Visa\n- [x] Pillow\n");
    assert.deepEqual(summarize(crlf), { open: ["Visa", "Pillow"], done: 0 });
  });
});

const tabbed = `# Shopping

- [ ] Milk
- [ ] Eggs

# Laptop

Budget **1500**.

\`\`\`sh
# not a tab
\`\`\`

- [ ] Order

# ~~Taxes~~

## Done

- [x] File
`;

describe("tabs", () => {
  it("reads each top-level heading as a tab, with where it starts and what is left", () => {
    const { intro, tabs: all } = tabs(`Call first.\n\n${tabbed}`);
    assert.equal(intro, "Call first.\n");
    assert.deepEqual(
      all.map(({ title, done, line, open }) => ({ title, done, line, open })),
      [
        { title: "Shopping", done: false, line: 3, open: 2 },
        { title: "Laptop", done: false, line: 8, open: 1 },
        { title: "Taxes", done: true, line: 18, open: 0 },
      ],
    );
    assert.equal(all[0].body, "\n- [ ] Milk\n- [ ] Eggs\n");
  });
  it("reads a fence to its real end, and a heading struck only in part as open", () => {
    const fenced =
      "# A\n\n````md\n```\n# no tab\n```\n````\n\n```inline``` code\n\n# ~~B~~ and ~~C~~\n";
    assert.deepEqual(
      tabs(fenced).tabs.map((t) => [t.title, t.done]),
      [
        ["A", false],
        ["~~B~~ and ~~C~~", false],
      ],
    );
  });
  it("has none on a plain list", () => {
    assert.deepEqual(tabs(list), { intro: list, tabs: [] });
  });
});

describe("settle with tabs", () => {
  it("moves a ticked item under its own tab's Done", () => {
    assert.equal(
      settle(toggleTask(tabbed, 3)),
      tabbed.replace("- [ ] Milk\n- [ ] Eggs\n", "- [ ] Eggs\n\n## Done\n\n- [x] Milk\n"),
    );
  });
  it("moves a done tab after the open ones, newest first, and a reopened one back before them", () => {
    const done = settle(toggleTab(tabbed, 1));
    assert.deepEqual(
      tabs(done).tabs.map((t) => [t.title, t.done]),
      [
        ["Laptop", false],
        ["Shopping", true],
        ["Taxes", true],
      ],
    );
    const taxes = tabs(done).tabs[2].line;
    assert.deepEqual(
      tabs(settle(toggleTab(done, taxes))).tabs.map((t) => [t.title, t.done]),
      [
        ["Laptop", false],
        ["Taxes", false],
        ["Shopping", true],
      ],
    );
  });
  it("marks a tab done whose heading is struck in part or ends in a tilde", () => {
    assert.equal(toggleTab("# ~~old~~ new\n", 1), "# ~~old new~~\n");
    for (const heading of ["# ~~old~~ new\n", "# Budget ~\n"])
      assert.equal(tabs(toggleTab(heading, 1)).tabs[0].done, true);
    assert.equal(toggleTab(toggleTab("# Budget ~\n", 1), 1), "# Budget ~\n");
  });
  it("leaves a line that is no tab alone", () => {
    assert.equal(toggleTab(tabbed, 3), tabbed);
  });
});

describe("addTab", () => {
  it("starts a tab after the open ones", () => {
    assert.deepEqual(
      tabs(addTab(tabbed, " Waiting  for ")).tabs.map((t) => t.title),
      ["Shopping", "Laptop", "Waiting for", "Taxes"],
    );
    assert.equal(addTab("", "Shopping"), "# Shopping\n");
    assert.equal(addTab("- [ ] a\n", "Shopping"), "- [ ] a\n\n# Shopping\n");
  });
});

describe("summarize with tabs", () => {
  it("counts open items across open tabs, and a done tab as one", () => {
    assert.deepEqual(summarize(toggleTask(tabbed, 3)), { open: ["Eggs", "Order"], done: 2 });
  });
});
