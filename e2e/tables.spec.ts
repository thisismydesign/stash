import { expect, test, type APIRequestContext } from "@playwright/test";
import type { Session } from "@supabase/supabase-js";
import {
  REST,
  admin,
  canSignIn,
  deleteUser,
  restHeaders,
  signIn,
  signedInUser,
} from "./session.ts";

const COLUMNS = [
  { key: "date", name: "Date", type: "date" },
  { key: "description", name: "Description", type: "text" },
  { key: "amount", name: "Amount", type: "number", decimals: 2 },
  { key: "category", name: "Category", type: "select", options: ["Income", "Software"] },
  { key: "deductible", name: "Deductible", type: "checkbox" },
  { key: "notes", name: "Notes", type: "text" },
];

async function seed(request: APIRequestContext, session: Session, title: string) {
  const made = await request.post(`${REST}/boards`, {
    headers: { ...restHeaders(session), Prefer: "return=representation" },
    data: { title, kind: "table", columns: COLUMNS },
  });
  expect(made.status()).toBe(201);
  const id = ((await made.json()) as { id: string }[])[0].id;
  for (const data of [
    {
      date: "2026-01-05",
      description: "Domain",
      amount: -14.99,
      category: "Software",
      deductible: true,
      notes: "A note long enough that the cell has to clip it before its end is in sight.",
    },
    { date: "2026-01-12", description: "Invoice", amount: 2400, category: "Income" },
  ]) {
    const row = await request.post(`${REST}/rows`, {
      headers: restHeaders(session),
      data: { board_id: id, data },
    });
    expect(row.status()).toBe(201);
  }
  return id;
}

const rows = async (request: APIRequestContext, session: Session, id: string) => {
  const got = await request.get(`${REST}/rows?board_id=eq.${id}&select=data&order=created_at`, {
    headers: restHeaders(session),
  });
  return ((await got.json()) as { data: Record<string, unknown> }[]).map((r) => r.data);
};

test.beforeEach(() => test.skip(!canSignIn, "the local stack is needed"));
test.afterEach(async () => {
  if (!canSignIn) return;
  const owner = await signedInUser();
  if (!owner) return;
  const db = admin();
  const { error } = await db.from("boards").delete().eq("owner", owner).like("title", "e2e%");
  if (error) throw new Error(error.message);
});

test("edits a table's cells, adds, filters, sorts and sums its rows, and downloads it", async ({
  page,
  request,
}) => {
  const session = await signIn(page);
  const id = await seed(request, session, "e2e Ledger");
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^e2e Ledger/ })).toContainText(
    "Date · Description · Amount · Category · Deductible · Notes",
  );
  await page.getByRole("button", { name: /^e2e Ledger/ }).click();
  await expect(page.getByRole("cell", { name: "Domain" })).toBeVisible();
  await expect(page.getByLabel("Total Amount")).toHaveText("2,385.01");

  await page.getByRole("cell", { name: "Domain" }).click();
  await page.getByRole("textbox", { name: "Description" }).fill("Domain renewal");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("cell", { name: "Domain renewal" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Deductible" }).nth(1).check();
  await expect
    .poll(() => rows(request, session, id))
    .toEqual([
      {
        date: "2026-01-05",
        description: "Domain renewal",
        amount: -14.99,
        category: "Software",
        deductible: true,
        notes: "A note long enough that the cell has to clip it before its end is in sight.",
      },
      {
        date: "2026-01-12",
        description: "Invoice",
        amount: 2400,
        category: "Income",
        deductible: true,
      },
    ]);

  // A typo keeps the cell; the message says why.
  await page.getByRole("cell", { name: "2,400.00" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("2,400");
  await page.keyboard.press("Enter");
  await expect(page.getByText("“2,400” is not a number; Amount kept as it was.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "2,400.00" })).toBeVisible();

  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByRole("textbox", { name: "Date" }).fill("2026-02-01");
  await page.keyboard.press("Enter");
  await page.getByRole("row").nth(3).getByRole("cell").nth(2).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("100");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Total Amount")).toHaveText("2,485.01");
  await expect
    .poll(async () => (await rows(request, session, id))[2])
    .toEqual({ date: "2026-02-01", amount: 100 });

  // Filters narrow the rows and the total with them.
  await page.getByRole("textbox", { name: "Filter rows" }).fill("domain");
  await expect(page.getByRole("cell", { name: "Invoice" })).toBeHidden();
  await expect(page.getByText("1 of 3 rows")).toBeVisible();
  await expect(page.getByLabel("Total Amount")).toHaveText("-14.99");
  await page.getByRole("textbox", { name: "Filter rows" }).clear();
  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator(".mantine-Chip-label", { hasText: "Income" }).click();
  await expect(page.getByLabel("Total Amount")).toHaveText("2,400.00");
  await page.getByLabel("Date from").fill("2026-02-01");
  await expect(page.getByText("No row matches.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("heading", { name: "e2e Ledger" }).click();
  await expect(page.getByText("3 rows")).toBeVisible();

  // A heading tells its full name on hover, and its right edge drags the column wider.
  await page.getByRole("button", { name: "Sort by Description" }).hover();
  await expect(page.getByRole("tooltip", { name: "Description" })).toBeVisible();
  const handle = page.getByRole("separator", { name: "Resize column" }).nth(1);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const savedColumns = async () => {
    const got = await request.get(`${REST}/boards?id=eq.${id}&select=columns`, {
      headers: restHeaders(session),
    });
    return ((await got.json()) as { columns: { key: string; width?: number }[] }[])[0].columns;
  };
  await expect
    .poll(savedColumns)
    .toEqual(COLUMNS.map((c) => (c.key === "description" ? { ...c, width: 250 } : c)));
  // A double click on the edge fits the column to its widest entry.
  await handle.dblclick();
  await expect.poll(async () => (await savedColumns())[1].width).not.toBe(250);
  expect((await savedColumns())[1].width).toBeGreaterThan(100);

  // A clipped cell tells the whole of itself on hover.
  await page.getByRole("cell", { name: /^A note long enough/ }).hover();
  await expect(page.getByRole("tooltip", { name: /before its end is in sight\.$/ })).toBeVisible();

  // A heading dragged past another moves its column, for good.
  const from = (await page.getByRole("button", { name: "Sort by Amount" }).boundingBox())!;
  const past = (await page.getByRole("button", { name: "Sort by Category" }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(past.x + past.width - 4, past.y + past.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("columnheader").nth(2)).toContainText("Category");
  await expect(page.getByRole("columnheader").nth(3)).toContainText("Amount");
  await expect
    .poll(async () => (await savedColumns()).map((c) => c.key))
    .toEqual(["date", "description", "category", "amount", "deductible", "notes"]);
  // The drag's end is not a click: the rows are still in the order they were added, not by amount.
  await expect(page.getByRole("row").nth(2)).toContainText("Invoice");

  await page.getByRole("button", { name: "Sort by Amount" }).click();
  await expect(page.getByRole("row").nth(1)).toContainText("Domain renewal");
  await page.getByRole("button", { name: "Sort by Amount" }).click();
  await expect(page.getByRole("row").nth(1)).toContainText("Invoice");

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Actions for e2e Ledger" }).click();
  await page.getByRole("menuitem", { name: "Download CSV" }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("e2e Ledger.csv");
  const csv = (await (await file.createReadStream()).toArray()).join("");
  expect(csv).toBe(
    "Date,Description,Category,Amount,Deductible,Notes\r\n" +
      "2026-01-05,Domain renewal,Software,-14.99,true," +
      "A note long enough that the cell has to clip it before its end is in sight.\r\n" +
      "2026-01-12,Invoice,Income,2400,true,\r\n" +
      "2026-02-01,,,100,,\r\n",
  );

  await page
    .getByRole("row", { name: /Invoice/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete row" }).click();
  await expect(page.getByRole("cell", { name: "Invoice" })).toBeHidden();
  await expect.poll(async () => (await rows(request, session, id)).length).toBe(2);
});

test("makes an empty table, gives it columns, and removes one with its cells", async ({
  page,
  request,
}) => {
  const session = await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  const dialog = page.getByRole("dialog");
  await page.getByLabel("Title").fill("e2e Taxes");
  await dialog.getByText("Table", { exact: true }).click();
  await expect(dialog.getByText("Template")).toBeHidden();
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/b\//);
  const id = page.url().split("/").pop()!;
  // An empty table opens on its columns.
  await expect(page.getByText("Columns", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add column" }).click();
  await page.getByRole("textbox", { name: "Name" }).last().pressSequentially("Paid on");
  await expect(page.getByText("Key: paid_on")).toBeVisible();
  await page.getByLabel("Type").last().selectOption("date");
  await page.getByRole("button", { name: "Add column" }).click();
  await page.getByRole("textbox", { name: "Name" }).last().fill("Amount");
  await page.getByLabel("Type").last().selectOption("number");
  // The grip drags a column above another.
  const grip = (await page
    .getByRole("button", { name: "Move column Amount", exact: true })
    .boundingBox())!;
  const above = (await page
    .getByRole("button", { name: "Move column Paid on", exact: true })
    .boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, above.y - 10, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("textbox", { name: "Name" }).first()).toHaveValue("Amount");
  await page.getByLabel("Description").fill("Money **in and out**, for the return.");
  // A choice column's options each wear a colour, picked from a swatch.
  await page.getByRole("button", { name: "Add column" }).click();
  await page.getByRole("textbox", { name: "Name" }).last().fill("Kind");
  await page.getByLabel("Type").last().selectOption("select");
  await page.getByRole("combobox", { name: "Choices" }).fill("Income");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Colour of Income" }).click();
  await page.getByRole("button", { name: "green", exact: true }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("columnheader").first()).toContainText("Amount");
  await expect(page.locator("strong", { hasText: "in and out" })).toBeVisible();
  const got = await request.get(`${REST}/boards?id=eq.${id}&select=columns`, {
    headers: restHeaders(session),
  });
  expect(((await got.json()) as { columns: unknown[] }[])[0].columns[2]).toEqual({
    key: "kind",
    name: "Kind",
    type: "select",
    options: ["Income"],
    colors: { Income: "green" },
  });
  await expect(page.getByRole("columnheader", { name: "Paid on" })).toBeVisible();
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("12.5");
  await page.keyboard.press("Enter");
  await page.getByRole("row").nth(1).getByRole("cell").nth(1).click();
  await page.getByRole("textbox", { name: "Paid on" }).fill("2026-05-01");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => rows(request, session, id))
    .toEqual([{ paid_on: "2026-05-01", amount: 12.5 }]);

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Remove column Amount" }).click();
  await expect(page.getByText("The column and its cells go from every row.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("columnheader", { name: "Amount" })).toBeHidden();
  await expect.poll(() => rows(request, session, id)).toEqual([{ paid_on: "2026-05-01" }]);
});

test("the database turns away cells that do not fit their columns, whoever writes", async ({
  page,
  request,
}) => {
  const session = await signIn(page);
  const id = await seed(request, session, "e2e Strict");
  const write = (data: Record<string, unknown>) =>
    request.post(`${REST}/rows`, { headers: restHeaders(session), data: { board_id: id, data } });
  const message = async (response: { status(): number; json(): Promise<unknown> }) => {
    expect(response.status()).toBe(400);
    return ((await response.json()) as { message: string }).message;
  };
  expect(await message(await write({ amount: "12" }))).toBe('Amount: "12" is not a number.');
  expect(await message(await write({ date: "2026-02-30" }))).toBe(
    'Date: "2026-02-30" is not a date.',
  );
  expect(await message(await write({ category: "Travel" }))).toBe(
    'Category: "Travel" is not one of its choices.',
  );
  expect(await message(await write({ deductible: "yes" }))).toBe(
    'Deductible: "yes" is not true or false.',
  );
  expect(await message(await write({ amout: 12 }))).toBe('No column has the key "amout".');
  expect((await write({ amount: 12, deductible: null })).status()).toBe(201);

  const columns = (columns: unknown) =>
    request.patch(`${REST}/boards?id=eq.${id}`, {
      headers: restHeaders(session),
      data: { columns },
    });
  expect((await columns([{ key: "Bad Key", name: "Bad", type: "text" }])).status()).toBe(400);
  expect((await columns([{ key: "x", name: "X", type: "interval" }])).status()).toBe(400);
  expect((await columns([{ key: "x", name: "X", type: "text", extra: 1 }])).status()).toBe(400);
  expect((await columns([{ key: "x", name: "X", type: "text", width: 10 }])).status()).toBe(400);
  expect(
    (
      await columns([
        { key: "x", name: "X", type: "select", options: ["A"], colors: { A: "magenta" } },
      ])
    ).status(),
  ).toBe(400);
  // The database names whichever misfit row it meets first.
  expect(
    await message(
      await columns(COLUMNS.map((c) => (c.key === "amount" ? { ...c, type: "text" } : c))),
    ),
  ).toMatch(/^A row does not fit the new columns\. Amount: (-14\.99|2400|12) is not text\.$/);
  const markdown = await request.patch(`${REST}/boards?id=eq.${id}`, {
    headers: restHeaders(session),
    data: { kind: "markdown", columns: [] },
  });
  expect(await message(markdown)).toBe(
    "A table with rows cannot change kind; delete its rows first.",
  );
});

test("shows a shared table's rows, and keeps rows to their owner's own tables", async ({
  page,
  request,
  browser,
}) => {
  const session = await signIn(page);
  const id = await seed(request, session, "e2e Shared ledger");
  const shared = await request.post(`${REST}/rpc/share_board`, {
    headers: restHeaders(session),
    data: { board_id: id },
  });
  const token = ((await shared.json()) as { share_token: string }[])[0].share_token;
  const reader = await browser.newContext();
  const guest = await reader.newPage();
  await guest.goto(`/s/${token}`);
  await expect(guest.getByRole("heading", { name: "e2e Shared ledger" })).toBeVisible();
  await expect(guest.getByRole("cell", { name: "Domain" })).toBeVisible();
  await expect(guest.getByLabel("Total Amount")).toHaveText("2,385.01");
  await expect(guest.getByRole("button", { name: "Add row" })).toBeHidden();
  await reader.close();

  // Another account cannot attach a row to this table, nor read its rows.
  const db = admin();
  const other = await db.auth.admin.createUser({
    email: "e2e-other@stash.test",
    password: "e2e-other-password",
    email_confirm: true,
  });
  if (other.error && !/already|exists|registered/i.test(other.error.message)) throw other.error;
  try {
    const signedIn = await request.post(
      `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: process.env.VITE_SUPABASE_KEY! },
        data: { email: "e2e-other@stash.test", password: "e2e-other-password" },
      },
    );
    const otherSession = (await signedIn.json()) as Session;
    const forged = await request.post(`${REST}/rows`, {
      headers: restHeaders(otherSession),
      data: { board_id: id, data: { description: "Not mine" } },
    });
    expect(forged.status()).toBe(403);
    const peek = await request.get(`${REST}/rows?board_id=eq.${id}`, {
      headers: restHeaders(otherSession),
    });
    expect(await peek.json()).toEqual([]);
  } finally {
    await deleteUser("e2e-other@stash.test");
  }
});
