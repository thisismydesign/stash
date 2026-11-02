# Deploy your own

Stash runs on Supabase (database, auth, Edge Function) and a Cloudflare Worker (the web app). Supabase may be self-hosted or a hosted project; the code is the same, only how it gets there differs.

## Supabase

1. Fill in `.env` from `.env.example`.
2. `pnpm run supabase:deploy` applies the migrations and deploys the function.
3. Auth settings SHOULD match `[auth]` in `supabase/config.toml`: sign-ups off (the function creates accounts), email provider on, minimum password length 8. Stash sends no email.
4. Sign up in the app, or have your agent do it. Auth's own sign-up stays off: the function creates accounts, so its throttle covers them.

### Self-hosted

The instance is a VM made with [supabase-vm](https://github.com/thisismydesign/supabase-vm): the official self-hosting bundle, reachable at `https://<vm>.<tailnet>.ts.net` over Tailscale Funnel, Postgres and SSH on the tailnet only. The values for `.env` are in `/opt/supabase/.env` inside the VM; `SUPABASE_DB_URL` selects this path. The bundle has no functions API, so the function's files are synced to `/opt/supabase/volumes/functions/` and its runtime restarted. The function MUST get `SITE_URL` (the web app) from the VM's compose file, next to `SUPABASE_PUBLIC_URL` and the keys the bundle already passes it; `docker compose up -d` applies that, a restart does not.

### Hosted

`supabase link --project-ref <ref>` once, leave `SUPABASE_DB_URL` and `STASH_VM_SSH_KEY_FILE` empty, and set the function's secret: `supabase secrets set STASH_SITE_URL=<site>`.

## Cloudflare

`pnpm run deploy`. The site is `https://<name>.<subdomain>.workers.dev`, where `<name>` is `name` in `app/wrangler.jsonc`.

## CI

`.github/workflows/ci.yml` deploys `main` and then runs the e2e specs against the site. It joins the tailnet with a Tailscale OAuth client that may tag devices `tag:ci`, and the tailnet's policy MUST let `tag:ci` reach the VM on 22 and 5432. The VM answers on 22 with OpenSSH, not Tailscale SSH, whose policy would block `tag:ci`. It reads these repository settings:

| Variables               | Secrets                |
| ----------------------- | ---------------------- |
| `SUPABASE_URL`          | `SUPABASE_DB_URL`      |
| `VITE_SUPABASE_URL`     | `SUPABASE_SECRET_KEY`  |
| `CLOUDFLARE_ACCOUNT_ID` | `VITE_SUPABASE_KEY`    |
| `PRODUCTION_URL`        | `STASH_VM_SSH_KEY`     |
| `STASH_TEST_EMAIL`      | `TS_OAUTH_CLIENT_ID`   |
|                         | `TS_OAUTH_SECRET`      |
|                         | `CLOUDFLARE_API_TOKEN` |

`PRODUCTION_URL` is the site. `STASH_VM_SSH_KEY` is the private key behind `STASH_VM_SSH_KEY_FILE`. The rest match `.env.example`.
