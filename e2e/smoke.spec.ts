import { expect, test } from "@playwright/test";
import { API, PUBLISHABLE_KEY, resetThrottle } from "./session.ts";

test.beforeAll(resetThrottle);

test("shows a visitor the example boards and offers to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("You are looking at example boards.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Asia trip/ })).toBeVisible();
  // Tried in memory: the tick shows, nothing is sent.
  const sent: string[] = [];
  await page.route("**/rest/v1/boards**", (route) => {
    sent.push(route.request().url());
    return route.abort();
  });
  await page.getByRole("button", { name: /^To-do/ }).click();
  await expect(page.getByRole("heading", { name: "To-do" })).toBeVisible();
  const ticked = page.getByRole("checkbox", { checked: true });
  await expect(ticked).toHaveCount(2);
  await page.getByRole("checkbox").first().click();
  await expect(ticked).toHaveCount(3);
  expect(sent).toEqual([]);
  await page.getByRole("button", { name: "Sign in to keep your own." }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sign in to Stash" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("serves the agent instructions and the API descriptions", async ({ request }) => {
  const headers = { apikey: PUBLISHABLE_KEY ?? "" };
  const instructions = await request.get(`${API}/agent`, { headers });
  expect(instructions.ok()).toBe(true);
  expect(await instructions.text()).toContain("# Stash for agents");
  const openapi = await request.get(`${API}/openapi.json`, { headers });
  expect(openapi.ok()).toBe(true);
  expect((await openapi.json()).paths["/token"]).toBeTruthy();
  const rest = await request.get(`${API}/rest-openapi.json`, { headers });
  expect(rest.ok()).toBe(true);
  expect(Object.keys((await rest.json()).paths).sort()).toEqual([
    "/boards",
    "/rpc/share_board",
    "/rpc/unshare_board",
  ]);
  expect((await request.get(`${API}/nothing`, { headers })).status()).toBe(404);
});

test("points agents from the site to its instructions", async ({ page, request }) => {
  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(llms.headers()["content-type"]).toContain("text/markdown");
  expect(await llms.text()).toContain("# Stash for agents");
  await page.goto("/");
  await expect(page.locator('head link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
    "href",
    "/llms.txt",
  );
  // Only Cloudflare reads _headers.
  if (process.env.E2E_BASE_URL)
    expect((await request.get("/")).headers().link).toContain("</llms.txt>");
});

test("keeps boards to signed-in callers and lets browsers preflight", async ({ request }) => {
  const headers = { apikey: PUBLISHABLE_KEY ?? "" };
  const list = await request.get(`${process.env.SUPABASE_URL}/rest/v1/boards?select=id`, {
    headers,
  });
  // The anonymous role has no grant on the table, and may only read a shared board by its token.
  expect(list.ok()).toBe(false);
  const share = await request.post(`${process.env.SUPABASE_URL}/rest/v1/rpc/share_board`, {
    headers,
    data: { board_id: "00000000-0000-0000-0000-000000000000" },
  });
  expect(share.ok()).toBe(false);
  const shared = await request.get(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/shared_board?token=not-a-token`,
    { headers },
  );
  expect(shared.ok()).toBe(true);
  expect(await shared.json()).toEqual([]);
  const preflight = await request.fetch(`${API}/token`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, apikey",
    },
  });
  expect(preflight.ok()).toBe(true);
  // The function answers `*`; a self-hosted gateway answers preflights itself and echoes the origin.
  expect(["*", "https://example.com"]).toContain(
    preflight.headers()["access-control-allow-origin"],
  );
});
