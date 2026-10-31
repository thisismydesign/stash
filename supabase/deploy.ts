// Applies the migrations and deploys the function; `pnpm run supabase:deploy` runs it with `.env`.
// With SUPABASE_DB_URL the target is a self-hosted instance (docs/deploy.md); without it, the linked hosted project.

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { SUPABASE_URL, SUPABASE_DB_URL, STASH_VM_SSH_KEY_FILE } = process.env;
// A failed command has said why; its arguments hold the database password.
const run = (command: string, args: string[], input?: Buffer) => {
  try {
    return execFileSync(command, args, {
      input,
      stdio: [input ? "pipe" : "inherit", "pipe", "inherit"],
    });
  } catch (e) {
    process.exit((e as { status?: number }).status ?? 1);
  }
};

if (!SUPABASE_DB_URL) {
  run("supabase", ["db", "push"]);
  run("supabase", ["functions", "deploy", "--use-api"]);
  process.exit();
}
if (!SUPABASE_URL?.startsWith("https://"))
  throw new Error(`Refusing to deploy to ${SUPABASE_URL}: not the production instance`);

const root = fileURLToPath(new URL("../", import.meta.url));
const vm = `ubuntu@${new URL(SUPABASE_DB_URL).hostname}`;
// The tailnet already authenticates the peer, and every CI runner is a fresh machine.
const sshArgs = [
  "-o",
  "StrictHostKeyChecking=accept-new",
  ...(STASH_VM_SSH_KEY_FILE ? ["-i", STASH_VM_SSH_KEY_FILE] : []),
];

run("ssh", [...sshArgs, vm, "true"]);
run("supabase", ["db", "push", "--db-url", SUPABASE_DB_URL]);

// The instance has no functions API: the runtime serves whatever is in its functions volume and resolves every import through the volume's `deno.jsonc`.
// The contract's `../../../shared/` would land outside the volume, so it is copied in and mapped there.
const stage = mkdtempSync(join(tmpdir(), "stash-functions-"));
try {
  cpSync(join(root, "supabase/functions"), stage, { recursive: true });
  cpSync(join(root, "shared"), join(stage, "shared"), { recursive: true });
  writeFileSync(
    join(stage, "deno.jsonc"),
    JSON.stringify({ imports: { "../../shared/": "./shared/" } }),
  );
  // `main` is the runtime's own router.
  run(
    "ssh",
    [
      ...sshArgs,
      vm,
      "cd /opt/supabase/volumes/functions && find . -mindepth 1 -maxdepth 1 ! -name main -exec rm -rf {} + && tar -xf -",
    ],
    execFileSync("tar", ["-cf", "-", "-C", stage, "."]),
  );
} finally {
  rmSync(stage, { recursive: true, force: true });
}
run("ssh", [...sshArgs, vm, "cd /opt/supabase && docker compose restart functions"]);
console.log(`Deployed to ${SUPABASE_URL}`);
