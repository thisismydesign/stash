import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Session } from "@supabase/supabase-js";
import { REST, TEST_EMAIL, admin, canSignIn, restHeaders, signIn } from "./session.ts";

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

test("makes a board, writes it, and deletes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Title").fill("e2e Fresh");
  await page.getByRole("dialog").getByText("Markdown", { exact: true }).click();
  await page.getByRole("combobox", { name: "Tags" }).fill("e2e Ideas");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Create" }).click();
  const editor = page.getByLabel("Content");
  await expect(editor).toBeVisible();
  await editor.fill("# Hello\n\nA [link](https://example.com).");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Hello" })).toBeVisible();
  await expect(page.getByRole("link", { name: "link" })).toHaveAttribute("target", "_blank");
  await expect(page.getByText("e2e ideas")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill("e2e Renamed");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByRole("heading", { name: "e2e Renamed" })).toBeVisible();

  await page.getByRole("button", { name: "Actions for e2e Renamed" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "New board" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^e2e Renamed/ })).toBeHidden();
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
