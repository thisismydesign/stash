// Gives the account `pnpm run dev` signs in as the example boards; replaces it if it exists. `pnpm run db:reset` runs it after the reset.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { exampleBoards } from "../../app/src/lib/demo/boards.ts";

process.loadEnvFile(new URL("../../.env.development", import.meta.url));
const { SUPABASE_URL, SUPABASE_SECRET_KEY, STASH_DEV_EMAIL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !STASH_DEV_EMAIL)
  throw new Error("Set SUPABASE_URL, SUPABASE_SECRET_KEY and STASH_DEV_EMAIL in .env.development");
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(SUPABASE_URL))
  throw new Error(`Refusing to seed ${SUPABASE_URL}: the dev account belongs on the local stack`);

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const check = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};

// Deleting the user removes its rows with it.
const { data: users, error } = await db.auth.admin.listUsers();
if (error) throw error;
const existing = users.users.find((u) => u.email === STASH_DEV_EMAIL);
if (existing) check(await db.auth.admin.deleteUser(existing.id));
const created = await db.auth.admin.createUser({ email: STASH_DEV_EMAIL, email_confirm: true });
if (created.error) throw created.error;
const owner = created.data.user.id;

const demo = new URL("../../app/src/lib/demo/", import.meta.url);
const file = (name: string) => readFileSync(new URL(name, demo), "utf8");
// One at a time, last first, so updated_at puts them in the order listed.
for (const board of exampleBoards(file).reverse())
  check(await db.from("boards").insert({ ...board, owner }));
console.log(`Seeded ${STASH_DEV_EMAIL}`);
