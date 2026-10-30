/// <reference lib="dom" />
import type { Page } from "@playwright/test";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

// The tables are untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;

export const TEST_EMAIL = process.env.STASH_TEST_EMAIL ?? "e2e@stash.test";
export const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
export const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

export const canSignIn = Boolean(SUPABASE_URL && PUBLISHABLE_KEY && SECRET_KEY);
export const API = `${SUPABASE_URL}/functions/v1/stash`;
export const REST = `${SUPABASE_URL}/rest/v1`;

export const persistedSessionKey = () =>
  `sb-${new URL(SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;

export const admin = (): Admin =>
  createClient(SUPABASE_URL!, SECRET_KEY!, { auth: { persistSession: false } });

export async function testSession(): Promise<Session> {
  const db = admin();
  const created = await db.auth.admin.createUser({ email: TEST_EMAIL, email_confirm: true });
  if (created.error && !/already|exists|registered/i.test(created.error.message))
    throw created.error;
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAIL });
  if (link.error) throw link.error;
  const anon = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const otp = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (otp.error || !otp.data.session) throw otp.error ?? new Error("No session");
  return otp.data.session;
}

/** Local runs all come from one address; clear its budget so repeated runs stay inside the rate limit. */
export async function resetThrottle() {
  if (process.env.E2E_BASE_URL || !canSignIn) return;
  await admin().from("throttle").delete().eq("route", "token");
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
