# Technical overview

Purpose: the stack and the principles every change MUST respect. Intent, not implementation.

## Stack

- App: React + Mantine via Vite, static assets on Cloudflare Workers.
- Backend: Supabase — Postgres, Auth (email + password, no emails sent), Edge Functions (Deno). Self-hosted in a VM; [supabase-vm](https://github.com/thisismydesign/supabase-vm) describes that setup, `docs/deploy.md` how Stash lands on it. The one deviation from that description: the VM has 3 GiB of memory, not 4.
- Data: the owner's boards, written by them in the app or by their agent through the REST API.

## Model

- A board is one row: `title`, `kind`, `content`, `tags`, `pinned`, `archived_at`, `share_token`.
- A shared board is one whose `share_token` is set; the link `#/s/<token>` shows it read-only to anyone. The database mints the token (`share_board`) and clears it (`unshare_board`); `shared_board(token)` is the only anonymous read, so nothing lists shared boards.
- Shared boards stay out of search and AI indexes: the page carries a `robots` meta tag while it shows one. The address is a fragment, so no server, header or `robots.txt` can tell it from the home page, and a crawler without scripts sees neither.
- `content` is the whole board as text: Markdown for `todo` and `markdown`, a document for `html`. One text column keeps every kind readable and writable by an agent with a single request.
- A visitor who is not signed in sees the example boards from `app/src/lib/demo`, kept in memory; the dev account starts with the same ones.
- `kind` chooses the renderer. `todo` renders task items as live checkboxes; ticking one moves it under a `## Done` heading, unticking brings it back. The rules live in `app/src/lib/todo.ts` and the agent instructions, and MUST agree.

## Principles

### Security first

- Multi-tenant by construction: `owner` column + RLS on every user table. Policies enforce isolation, not application code.
- Secrets never reach the browser. Agent keys are hashed before they are stored; the function reads hashes only.
- HTML boards render in a sandboxed iframe with no access to the app's origin.
- Public endpoints are rate-limited per address. `shared_board` is the exception: its token has 122 random bits, and a throttle would cost the round trip it saves.

### Lean on Supabase

- Auth, PostgREST, RLS and generated OpenAPI before custom code.
- Edge Functions only for what those cannot do: agent docs and key exchange.

### One contract between app and backend

- `app/` and `supabase/functions/` never import each other. What both must agree on lives once in `shared/`: the rows, the values the schema constrains, the agent-key protocol.
- `shared/` holds only that contract. It imports nothing, so it runs in the browser, Deno and Node alike.
- Tooling (`supabase/seed/`, `tests/`, `e2e/`) may import any side.

### Mobile-first

### Agent-first

- Everything a person can do, an agent MUST be able to do via the API.
- Capabilities ship with their API and docs.
