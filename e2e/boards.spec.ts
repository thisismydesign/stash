import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Session } from "@supabase/supabase-js";
import {
  API,
  REST,
  SUPABASE_URL,
  TEST_EMAIL,
  admin,
  canSignIn,
  restHeaders,
  signIn,
} from "./session.ts";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const TODO = `- [ ] Visa
- [ ] Pillow
- [ ] Bike
  - [ ] Helmet
`;

async function seed(
  request: APIRequestContext,
  session: Session,
  board: Record<string, unknown>,
): Promise<string> {
  const made = await request.post(`${REST}/boards`, {
    headers: { ...restHeaders(session), Prefer: "return=representation" },
    data: board,
  });
  expect(made.status()).toBe(201);
  return ((await made.json()) as { id: string }[])[0].id;
}

const content = async (request: APIRequestContext, session: Session, id: string) => {
  const got = await request.get(`${REST}/boards?id=eq.${id}&select=content`, {
    headers: restHeaders(session),
  });
  return ((await got.json()) as { content: string }[])[0].content;
};

test.describe.configure({ mode: "serial" });

test.beforeEach(() => test.skip(!canSignIn, "the local stack is needed"));
// The service key sees every account, and the smoke run points at the deployed site: only the test user's boards go.
test.afterEach(async () => {
  if (!canSignIn) return;
  const db = admin();
  const users = await db.auth.admin.listUsers();
  if (users.error) throw users.error;
  const owner = users.data.users.find((u) => u.email === TEST_EMAIL)?.id;
  if (!owner) return;
  const { error } = await db.from("boards").delete().eq("owner", owner).like("title", "e2e%");
  if (error) throw new Error(error.message);
  const files = await db.storage.from("images").list(owner);
  if (files.data?.length)
    await db.storage.from("images").remove(files.data.map((f) => `${owner}/${f.name}`));
});

async function open(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("shows boards as tiles and as a list, filtered by tag, pinned on top", async ({
  page,
  request,
}) => {
  const session = await signIn(page);
  await seed(request, session, {
    title: "e2e Errands",
    kind: "todo",
    content: TODO,
    tags: ["e2e-admin"],
  });
  await seed(request, session, {
    title: "e2e Trip notes",
    kind: "markdown",
    content: "# Trip\n\nPack light.",
    tags: ["e2e-travel"],
  });
  await page.goto("/");
  const errands = page.getByRole("button", { name: /^e2e Errands/ });
  await expect(errands).toBeVisible();
  await expect(errands).toContainText("3 open");
  await expect(page.getByRole("button", { name: /^e2e Trip notes/ })).toContainText("Pack light");

  // Filters and the view live behind one button. The chip's own input is hidden; its label takes the click.
  const settings = page.getByRole("button", { name: "View and filters" });
  const chip = (name: string) => page.locator(".mantine-Chip-label", { hasText: name });
  await settings.click();
  await chip("e2e-travel").click();
  await expect(errands).toBeHidden();
  await chip("e2e-travel").click();
  await chip("e2e-admin").click();
  await expect(errands).toBeVisible();
  await expect(page.getByRole("button", { name: /^e2e Trip notes/ })).toBeHidden();
  await chip("e2e-admin").click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Actions for e2e Errands" }).click();
  await page.getByRole("menuitem", { name: "Pin" }).click();
  await expect(page.getByRole("heading", { name: "Pinned" })).toBeVisible();
  await expect(errands.getByRole("img", { name: "Pinned" })).toBeVisible();

  const trip = page.getByRole("button", { name: /^e2e Trip notes/ });
  await page.getByRole("button", { name: "Actions for e2e Trip notes" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(trip).toBeHidden();
  await settings.click();
  await page.getByLabel("Show archived").check();
  await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();
  await expect(trip).toBeVisible();

  await page.getByRole("img", { name: "List" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row", { name: /^e2e Errands/ })).toBeVisible();
  await page.getByRole("row", { name: /^e2e Trip notes/ }).click();
  await expect(page.getByRole("heading", { name: "e2e Trip notes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trip", exact: true })).toBeVisible();
});

test("ticks a task under Done and brings it back", async ({ page, request }) => {
  const session = await signIn(page);
  const id = await seed(request, session, { title: "e2e Tasks", kind: "todo", content: TODO });
  await open(page, "e2e Tasks");
  const boxes = page.getByRole("checkbox");
  await expect(boxes).toHaveCount(4);
  await boxes.nth(1).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();
  await expect
    .poll(() => content(request, session, id))
    .toBe("- [ ] Visa\n- [ ] Bike\n  - [ ] Helmet\n\n## Done\n\n- [x] Pillow\n");
  await page.getByRole("checkbox", { name: "Done" }).click();
  await expect
    .poll(() => content(request, session, id))
    .toBe("- [ ] Visa\n- [ ] Bike\n  - [ ] Helmet\n- [ ] Pillow\n\n## Done\n\n");
});

test("makes a board, writes it formatted and as source, and deletes it", async ({
  page,
  request,
}) => {
  const session = await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Title").fill("e2e Fresh");
  await page.getByRole("dialog").getByText("Markdown", { exact: true }).click();
  await page.getByRole("combobox", { name: "Tags" }).fill("e2e Ideas");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/b\//);
  const id = page.url().split("/").pop()!;
  // A Markdown board opens formatted: what is typed shows rendered, and the source is Markdown.
  const editor = page.getByLabel("Content");
  await expect(editor).toBeVisible();
  await editor.pressSequentially("# Hello\nSome **bold** words.");
  await expect(editor.getByRole("heading", { name: "Hello" })).toBeVisible();
  await expect(editor.locator("strong")).toHaveText("bold");
  await page.getByText("Source", { exact: true }).click();
  await expect(editor).toHaveValue("# Hello\n\nSome **bold** words.\n");
  await editor.fill("# Hello\n\nA [link](https://example.com).");
  await page.getByText("Formatted", { exact: true }).click();
  await expect(editor.getByRole("link", { name: "link" })).toBeVisible();
  await expect
    .poll(() => content(request, session, id))
    .toBe("# Hello\n\nA [link](https://example.com).");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Hello" })).toBeVisible();
  await expect(page.getByRole("link", { name: "link" })).toHaveAttribute("target", "_blank");
  await expect(page.getByText("e2e ideas")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill("e2e Renamed");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByRole("heading", { name: "e2e Renamed" })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByText("Source", { exact: true }).click();
  await page.getByLabel("Content").fill("# Left mid-edit");
  await page.getByRole("main").getByRole("button", { name: "All boards" }).click();
  await expect.poll(() => content(request, session, id)).toBe("# Left mid-edit");
  await page.getByRole("button", { name: /^e2e Renamed/ }).click();

  await page.getByRole("button", { name: "Actions for e2e Renamed" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "New board" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^e2e Renamed/ })).toBeHidden();
});

test("builds a table with the editor's table tools", async ({ page, request }) => {
  const session = await signIn(page);
  const id = await seed(request, session, {
    title: "e2e Table",
    kind: "markdown",
    content: "# Plan\n\nStops.\n",
  });
  await open(page, "e2e Table");
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Content").getByText("Stops.")).toBeVisible();
  // Row and column tools show only inside a table.
  await expect(page.getByRole("button", { name: "Add column after" })).toBeHidden();
  await page.getByRole("button", { name: "Insert table" }).click();
  await page.getByRole("button", { name: "Insert 2 × 2 table" }).click();
  await page.keyboard.type("City");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Nights");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Hanoi");
  // Rows and columns go next to the cell the cursor is in.
  await page.getByRole("button", { name: "Add column after" }).click();
  await page.getByRole("button", { name: "Add row after" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect
    .poll(() => content(request, session, id))
    .toBe(
      "# Plan\n\nStops.\n\n" +
        "| City  |     | Nights |\n" +
        "| ----- | --- | ------ |\n" +
        "| Hanoi |     |        |\n" +
        "|       |     |        |\n",
    );
});

test("makes a page from a template", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  const dialog = page.getByRole("dialog");
  await page.getByLabel("Title").fill("e2e Kitchen");
  await expect(dialog.getByRole("radio", { name: /^Blank/ })).toBeChecked();
  await dialog.getByText("Markdown", { exact: true }).click();
  await expect(dialog.getByText("Template")).toBeHidden();
  await dialog.getByText("Page", { exact: true }).click();
  await dialog.getByRole("radio", { name: /^Mood board/ }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "e2e Kitchen" })).toBeVisible();
  await expect(page.getByText("Page", { exact: true })).toBeVisible();
  const frame = page.frameLocator('iframe[title="e2e Kitchen"]');
  await expect(frame.getByRole("heading", { name: "e2e Kitchen" })).toBeVisible();
  await expect(frame.getByText("Your picture").first()).toBeVisible();
});

test("shares a board by link until sharing is turned off", async ({ page, request, browser }) => {
  const session = await signIn(page);
  await seed(request, session, {
    title: "e2e Shared",
    kind: "markdown",
    content: "# Plan\n\nMeet at noon.",
    tags: ["e2e-team"],
  });
  await open(page, "e2e Shared");
  await page.getByRole("button", { name: "Actions for e2e Shared" }).click();
  await page.getByRole("menuitem", { name: "Share…" }).click();
  const dialog = page.getByRole("dialog");
  const sharing = dialog.getByLabel("Anyone with the link can view");
  await sharing.click();
  await expect(dialog.getByRole("textbox", { name: "Link" })).toBeVisible();
  const link = await dialog.getByRole("textbox", { name: "Link" }).inputValue();
  expect(link).toMatch(/\/s\/[0-9a-f]{32}$/);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Shared", { exact: true })).toBeVisible();

  // The link's holder is signed out and sees the board, nothing else of the account's.
  const reader = await browser.newContext();
  const guest = await reader.newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: "e2e Shared" })).toBeVisible();
  await expect(guest.getByText("Meet at noon.")).toBeVisible();
  await expect(guest.getByText("e2e-team")).toBeVisible();
  await expect(guest.getByText("You are looking at example boards.")).toBeHidden();
  await expect(guest.getByRole("button", { name: "Edit" })).toBeHidden();
  // A link from before addresses were paths still opens.
  await guest.goto(link.replace("/s/", "/#/s/"));
  await expect(guest.getByRole("heading", { name: "e2e Shared" })).toBeVisible();
  expect(new URL(guest.url()).pathname).toBe(new URL(link).pathname);

  await page.getByRole("button", { name: "Actions for e2e Shared" }).click();
  await page.getByRole("menuitem", { name: "Sharing…" }).click();
  await sharing.click();
  await expect(dialog.getByRole("textbox", { name: "Link" })).toBeHidden();
  await guest.reload();
  await expect(guest.getByText("This link no longer works")).toBeVisible();
  await guest.getByRole("button", { name: "Go to Stash" }).click();
  await expect(guest.getByText("You are looking at example boards.")).toBeVisible();
  await reader.close();
});

test("gives a board a picture by link or upload, and shows it while shared", async ({
  page,
  request,
  browser,
}) => {
  const session = await signIn(page);
  const id = await seed(request, session, { title: "e2e Garden", kind: "markdown", content: "" });
  await page.goto("/");
  const tile = page.getByRole("button", { name: /^e2e Garden/ });
  await page.getByRole("button", { name: "Actions for e2e Garden" }).click();
  await page.getByRole("menuitem", { name: "Picture…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Or link to one").fill("http://example.com/x.png");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("The link must start with https://")).toBeVisible();
  await dialog.getByLabel("Or link to one").fill("https://example.com/x.png");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(tile.locator("img")).toHaveAttribute("src", "https://example.com/x.png");

  await page.getByRole("button", { name: "Actions for e2e Garden" }).click();
  await page.getByRole("menuitem", { name: "Picture…" }).click();
  // Mantine's file input is a button over a hidden input.
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByLabel("Upload").click();
  await (await chooser).setFiles({ name: "x.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(tile.locator("img")).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/images\//);
  await expect
    .poll(() => tile.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);
  const path = (
    (await (
      await request.get(`${REST}/boards?id=eq.${id}&select=image`, {
        headers: restHeaders(session),
      })
    ).json()) as { image: string }[]
  )[0].image;
  expect(path).toMatch(new RegExp(`^${session.user.id}/`));

  // The file is private: the token is the only way in for a reader, and only while the board is shared.
  const reader = await browser.newContext();
  const guest = await reader.newPage();
  const bare = await guest.request.get(`${SUPABASE_URL}/storage/v1/object/public/images/${path}`);
  expect(bare.status()).toBe(400);
  const shared = await request.post(`${REST}/rpc/share_board`, {
    headers: restHeaders(session),
    data: { board_id: id },
  });
  const token = ((await shared.json()) as { share_token: string }[])[0].share_token;
  await guest.goto(`/s/${token}`);
  await expect(guest.getByRole("heading", { name: "e2e Garden" })).toBeVisible();
  await expect
    .poll(() => guest.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);
  const unshared = await request.post(`${REST}/rpc/unshare_board`, {
    headers: restHeaders(session),
    data: { board_id: id },
  });
  expect(unshared.ok()).toBe(true);
  expect((await guest.request.get(`${API}/image?token=${token}`)).status()).toBe(404);
  await reader.close();

  await page.getByRole("button", { name: "Actions for e2e Garden" }).click();
  await page.getByRole("menuitem", { name: "Picture…" }).click();
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(tile.locator("img")).toHaveCount(0);
  await expect
    .poll(async () => (await admin().storage.from("images").list(session.user.id)).data?.length)
    .toBe(0);
});

test("renders an HTML board in a sandbox", async ({ page, request }) => {
  const session = await signIn(page);
  await seed(request, session, {
    title: "e2e Page",
    kind: "html",
    content:
      "<!doctype html><html><body><h1 id='h'>Cars</h1><script>document.getElementById('h').textContent += ' sorted'</script></body></html>",
  });
  await open(page, "e2e Page");
  const frame = page.frameLocator('iframe[title="e2e Page"]');
  await expect(frame.getByRole("heading", { name: "Cars sorted" })).toBeVisible();
  await expect(page.locator('iframe[title="e2e Page"]')).toHaveAttribute(
    "sandbox",
    /allow-scripts/,
  );
  await expect(page.locator('iframe[title="e2e Page"]')).not.toHaveAttribute(
    "sandbox",
    /allow-same-origin/,
  );
});
