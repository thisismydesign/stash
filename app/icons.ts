// Renders public/favicon.svg to the PNG icons the manifest and iOS need. `pnpm run icons`.

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const dir = new URL("./public/", import.meta.url);
const svg = readFileSync(new URL("favicon.svg", dir), "utf8");
const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

// Maskable icons are cropped to a circle or squircle, so the artwork sits inside the safe zone on a full background.
async function render(file: string, size: number, maskable = false) {
  const art = maskable ? Math.round(size * 0.8) : size;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${maskable ? "#1a1b1e" : "transparent"}"><img src="${data}" width="${art}" height="${art}"></body>`,
  );
  writeFileSync(new URL(file, dir), await page.screenshot({ omitBackground: true }));
  console.log(file);
}

await render("apple-touch-icon.png", 180);
await render("icon-192.png", 192);
await render("icon-512.png", 512);
await render("icon-maskable-512.png", 512, true);
await browser.close();
