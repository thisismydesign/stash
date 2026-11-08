/// <reference lib="dom" />
import type { Page } from "@playwright/test";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

// The tables are untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;

const TEST_EMAIL = process.env.STASH_TEST_EMAIL ?? "e2e@stash.test";
export const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
export const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

export const canSignIn = Boolean(SUPABASE_URL && PUBLISHABLE_KEY && SECRET_KEY);
export const API = `${SUPABASE_URL}/functions/v1/stash`;
export const REST = `${SUPABASE_URL}/rest/v1`;

/** Each worker signs in as its own account, so specs running side by side never see each other's boards. */
const testEmail = () => {
  const worker = Number(process.env.TEST_PARALLEL_INDEX);
  return worker ? TEST_EMAIL.replace("@", `+w${worker}@`) : TEST_EMAIL;
};

export const persistedSessionKey = () =>
  `sb-${new URL(SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;

export const admin = (): Admin =>
  createClient(SUPABASE_URL!, SECRET_KEY!, { auth: { persistSession: false } });

// A worker's session is minted once: every test of the worker reuses it.
let session: Promise<Session> | undefined;

/** The worker's account, once a test has signed in. */
export const signedInUser = async () => (await session)?.user.id;

export function testSession(): Promise<Session> {
  session ??= mintSession().catch((e: unknown) => {
    session = undefined;
    throw e;
  });
  return session;
}

async function mintSession(): Promise<Session> {
  const email = testEmail();
  const db = admin();
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && !/already|exists|registered/i.test(created.error.message))
    throw created.error;
  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const anon = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const otp = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (otp.error || !otp.data.session) throw otp.error ?? new Error("No session");
  return otp.data.session;
}

/** Local runs all come from one address; clear its budgets so repeated runs stay inside the rate limits. */
export async function resetThrottle() {
  if (process.env.E2E_BASE_URL || !canSignIn) return;
  await admin().from("throttle").delete().in("route", ["token", "signup"]);
}

export async function deleteUser(email: string) {
  const db = admin();
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (user) await db.auth.admin.deleteUser(user.id);
}

export async function signIn(page: Page): Promise<Session> {
  const session = await testSession();
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [persistedSessionKey(), JSON.stringify(session)],
  );
  return session;
}

export const restHeaders = (session: Session) => ({
  apikey: PUBLISHABLE_KEY ?? "",
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
});
