type Line = { text: string; top: number; bottom: number };

/** Where a reader is in a body scrolled under `ceiling`: the line there, and how far through the body that is. */
export type Place = { ceiling: number; through: number; line?: Line & { nth: number } };

function lines(body: HTMLElement): Line[] {
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const out: Line[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    range.selectNodeContents(node);
    const { top, bottom } = range.getBoundingClientRect();
    if (bottom > top) out.push({ text, top, bottom });
  }
  return out;
}

/** Undefined while the top of `body` still shows: nothing is scrolled away to return to. */
export function placeIn(body: HTMLElement, ceiling: number): Place | undefined {
  const { top, height } = body.getBoundingClientRect();
  if (top >= ceiling) return undefined;
  const all = lines(body);
  const line = all.find((l) => l.bottom > ceiling);
  const before = line ? all.slice(0, all.indexOf(line)) : [];
  return {
    ceiling,
    through: (ceiling - top) / height,
    line: line && { ...line, nth: before.filter((l) => l.text === line.text).length },
  };
}

/** Scrolls `body`, rendered anew since, to show the same line at the same height; without that line, to as far through. */
export function returnTo(body: HTMLElement, { ceiling, through, line }: Place) {
  const same = lines(body).filter((l) => l.text === line?.text);
  const found = (line && same.at(line.nth)) ?? same.at(-1);
  const { top, height } = body.getBoundingClientRect();
  window.scrollBy(0, line && found ? found.top - line.top : top + through * height - ceiling);
}
