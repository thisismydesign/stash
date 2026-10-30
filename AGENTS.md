# Stash

Personal notepad: boards of notes, lists and ideas, kept by the owner and their agent.

## Docs

- `README.md` — for humans.
- `docs/` — documentation.
- `AGENTS.md` — how to work here.

## Layout

```
app/                     web app; app/wrangler.jsonc deploys app/dist and worker.ts, which serves /llms.txt
shared/                  the app–backend contract; see docs/technical.md
supabase/functions/      stash (public API: agent docs, key exchange), _shared
supabase/migrations/     schema, policies, grants
supabase/seed/           local data: the dev account and its example boards
lint/                    custom ESLint rules; each file is on as an error
tests/                   node:test unit specs
e2e/                     Playwright specs against the preview build and the local stack
```

## Commands

```bash
mise install && cp .env.example .env && pnpm install && supabase link
supabase start && node supabase/seed/dev-account.ts  # local stack (needs Docker) and the dev account
pnpm run dev                                   # local stack; Sign in with empty fields signs in as dev@stash.test
supabase stop && supabase start                # after a function first imports a shared/ file: the stack mounts them at start
pnpm run db:reset                              # re-apply migrations and seeds, including the dev account
pnpm run lint && pnpm run typecheck && pnpm run test
pnpm run e2e                                   # preview build + browser specs on the local stack
E2E_BASE_URL=https://... pnpm run e2e          # same specs against a deployed site; needs .env
pnpm run icons                                 # app/public PNG icons from favicon.svg, after changing it
pnpm run supabase:deploy && pnpm run deploy
```

## Rules

- MUST NOT read `.env`; document new vars in `.env.example`.
- Development and tests MUST use the local stack; only deploys and `E2E_BASE_URL` runs touch the hosted project.
- Tables MUST grant their privileges explicitly; the local stack grants none by default.
- MUST NOT deploy without instruction.
- Schema changes MUST be new migration files.
- User-data tables MUST have `owner` and RLS policies.
- Everything a person can do in the app, an agent MUST be able to do through the API; `supabase/functions/stash/agent.md` MUST describe it.
- Code MUST explain itself; comments SHOULD NOT be needed. Comments and docs MAY record a reason the code cannot show and MUST NOT explain how it works.
- All prose — comments, docs, messages — MUST stay terse; prescriptions use RFC 2119.
