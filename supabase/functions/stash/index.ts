// Public: agent docs and agent-key exchange. Boards themselves go through PostgREST with a session.

import { createClient } from "npm:@supabase/supabase-js@2";
import { KEY_PREFIX, sha256Hex } from "../../../shared/keys.ts";
import { db, PUBLISHABLE_KEY, SECRET_KEY, SUPABASE_URL } from "../_shared/db.ts";
import { CORS, json, text } from "../_shared/http.ts";
import { HOUR_MS, throttled } from "../_shared/throttle.ts";
import { agentInstructions, endpoints, openapi, type Endpoints } from "./docs.ts";

// Self-hosted, the compose file hands the function Auth's site URL; the local CLI cannot pass that name and uses config.toml's.
const SITE = Deno.env.get("STASH_SITE_URL") || Deno.env.get("SITE_URL");
if (!SITE) throw new Error("Set STASH_SITE_URL or SITE_URL");
// Self-hosted, SUPABASE_URL is the gateway's address inside its network; agents need the public one.
const PUBLIC_URL = (
  Deno.env.get("SUPABASE_PUBLIC_URL") ||
  Deno.env.get("STASH_PUBLIC_URL") ||
  SUPABASE_URL
).replace(/\/$/, "");

const clientIp = (request: Request) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
  "unknown";

async function mintSession(email: string) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(link.error.message);
  const anon = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const verified = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (verified.error || !verified.data.session)
    throw new Error(verified.error?.message ?? "Could not start a session.");
  const { access_token, refresh_token, expires_at } = verified.data.session;
  return { access_token, refresh_token, expires_at };
}

const TOKEN_LIMIT = { max: 60, perMs: HOUR_MS };

async function exchangeAgentKey(request: Request, api: Endpoints, ip: string) {
  if (await throttled(ip, "token", TOKEN_LIMIT))
    return json({ error: "Too many attempts from this address. Try again in an hour." }, 429);
  const key = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key.startsWith(KEY_PREFIX))
    return json({ error: "Send the agent key as Authorization: Bearer <key>." }, 401);
  const found = await db
    .from("api_keys")
    .select("id,owner")
    .eq("key_hash", await sha256Hex(key))
    .is("revoked_at", null)
    .maybeSingle();
  if (!found.data) return json({ error: "Unknown or revoked key." }, 401);
  const user = await db.auth.admin.getUserById(found.data.owner);
  if (user.error || !user.data.user?.email)
    return json({ error: "The key's owner no longer exists." }, 401);
  const session = await mintSession(user.data.user.email);
  await db
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", found.data.id);
  return json({ session, api: endpoints(api) });
}

type RestSpec = { paths?: Record<string, unknown>; definitions?: Record<string, unknown> };

// The schema changes only with a migration, and every deploy starts fresh instances; the TTL covers migrations pushed on their own.
const REST_SPEC_TTL_MS = 10 * 60_000;
let restSpec: { at: number; spec: Promise<RestSpec> } | undefined;

// Supabase serves its generated REST description only to the service role.
function fetchRestSpec(): Promise<RestSpec> {
  if (restSpec && Date.now() - restSpec.at < REST_SPEC_TTL_MS) return restSpec.spec;
  const spec = fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SECRET_KEY } }).then(
    async (response) => {
      if (!response.ok) throw new Error(`REST description unavailable (${response.status})`);
      return (await response.json()) as RestSpec;
    },
  );
  restSpec = { at: Date.now(), spec };
  spec.catch(() => (restSpec = undefined));
  return spec;
}

async function restOpenapi(api: Endpoints) {
  const spec = await fetchRestSpec();
  const sessionPaths = new Set(["boards", "rpc/share_board", "rpc/unshare_board"]);
  const pick = (o: Record<string, unknown> | undefined, strip: (k: string) => string) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => sessionPaths.has(strip(k))));
  const u = endpoints(api);
  const rest = new URL(u.rest);
  return {
    ...spec,
    // PostgREST describes itself from inside the stack; callers go through the gateway.
    host: rest.host,
    basePath: rest.pathname,
    schemes: [rest.protocol.replace(":", "")],
    info: {
      title: "Stash data",
      version: "1",
      description:
        "The user's own boards. Create with POST, change with PATCH ?id=eq.<id>; share and unshare through the rpc paths.",
    },
    securityDefinitions: {
      apikey: {
        type: "apiKey",
        in: "header",
        name: "apikey",
        description: `Always ${api.publishableKey}`,
      },
      session: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: `Bearer <access_token>; see ${u.openapi} for getting a session`,
      },
    },
    security: [{ apikey: [], session: [] }],
    paths: pick(spec.paths, (k) => k.replace(/^\//, "")),
    definitions: pick(spec.definitions, (k) => k),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(request.url);
  // Supabase mounts the function at /functions/v1/stash; routes are relative to it.
  const route = url.pathname.replace(/^\/stash/, "").replace(/\/$/, "") || "/";
  const functions = `${PUBLIC_URL}/functions/v1`;
  const api: Endpoints = {
    functions,
    base: `${functions}/stash`,
    supabase: PUBLIC_URL,
    publishableKey: PUBLISHABLE_KEY,
    site: SITE,
  };
  const method = request.method;

  try {
    if (route === "/agent" && method === "GET")
      return text(await agentInstructions(api), "text/markdown; charset=utf-8");
    if (route === "/openapi.json" && method === "GET") return json(openapi(api));
    if (route === "/rest-openapi.json" && method === "GET") return json(await restOpenapi(api));
    if (route === "/token" && method === "POST")
      return await exchangeAgentKey(request, api, clientIp(request));
    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
