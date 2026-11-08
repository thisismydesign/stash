import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  API,
  PUBLISHABLE_KEY,
  SUPABASE_URL,
  canSignIn,
  deleteUser,
  resetThrottle,
} from "./session.ts";

// Creating accounts is for the local stack: the deployed site keeps only the test accounts.
const local = !process.env.E2E_BASE_URL;
const password = () => `pw-${crypto.randomUUID()}`;

test.beforeAll(resetThrottle);
test.beforeEach(() => test.skip(!local || !canSignIn, "the local stack is needed"));

async function fillAndSubmit(page: Page, email: string, secret: string, submit: string) {
  const form = page.locator("form", { has: page.getByRole("button", { name: submit }) });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password", { exact: true }).fill(secret);
  await form.getByRole("button", { name: submit }).click();
}

test("signs up in the browser, then signs back in with the password", async ({ page }) => {
  const email = `signup-${Date.now()}@stash.test`;
  const secret = password();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign up to keep your own." }).click();
    await fillAndSubmit(page, email, "short", "Create account");
    await expect(page.getByText("The password needs at least 8 characters.")).toBeVisible();
    await fillAndSubmit(page, email, secret, "Create account");
    await expect(page.getByText("You are looking at example boards.")).toBeHidden();
    await expect(page.getByText("No boards yet. Make one, or ask your agent to.")).toBeVisible();
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByText("You are looking at example boards.")).toBeVisible();

    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await fillAndSubmit(page, email, "wrong-password", "Sign in");
    await expect(page.getByText("Invalid login credentials")).toBeVisible();
    await fillAndSubmit(page, email, secret, "Sign in");
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(page.getByText(email)).toBeVisible();
  } finally {
    await deleteUser(email);
  }
});

test("signs an agent up without a password and returns one to sign in with", async ({
  request,
}) => {
  const email = `agent-${Date.now()}@stash.test`;
  try {
    const headers = { apikey: PUBLISHABLE_KEY ?? "" };
    const short = await request.post(`${API}/signup`, {
      headers,
      data: { email, password: "short" },
    });
    expect(short.status()).toBe(400);
    const created = await request.post(`${API}/signup`, { headers, data: { email } });
    expect(created.status()).toBe(201);
    const body = await created.json();
    expect(body.session.access_token).toBeTruthy();
    expect(body.password.length).toBeGreaterThanOrEqual(20);
    const anon = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const signedIn = await anon.auth.signInWithPassword({ email, password: body.password });
    expect(signedIn.error).toBeNull();
    const again = await request.post(`${API}/signup`, { headers, data: { email } });
    expect(again.status()).toBe(409);
  } finally {
    await deleteUser(email);
  }
});
