import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { settle, summarize, toggleTask } from "../app/src/lib/todo.ts";

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
