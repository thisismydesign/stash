import { MIN_PASSWORD_LENGTH } from "../../../shared/api.ts";
import { shareLink } from "../../../shared/tables.ts";
import template from "./agent.ts";

export type Endpoints = {
  /** Where the project's functions live. */
  functions: string;
  /** This function. */
  base: string;
  /** Project URL. */
  supabase: string;
  /** Publishable key; sent as the `apikey` header on every Supabase call. */
  publishableKey: string;
  /** The web app. */
  site: string;
};

export const endpoints = (e: Endpoints) => ({
  signup: `${e.base}/signup`,
  token: `${e.base}/token`,
  tokenRefresh: `${e.supabase}/auth/v1/token?grant_type=refresh_token`,
  rest: `${e.supabase}/rest/v1`,
  storage: `${e.supabase}/storage/v1`,
  user: `${e.supabase}/auth/v1/user`,
  restOpenapi: `${e.base}/rest-openapi.json`,
  openapi: `${e.base}/openapi.json`,
  instructions: `${e.base}/agent`,
  publishableKey: e.publishableKey,
  site: e.site,
  shareLink: shareLink(e.site, "<share_token>"),
});

export function agentInstructions(e: Endpoints) {
  const values: Record<string, string> = endpoints(e);
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`agent.ts: unknown placeholder {{${key}}}`);
    return values[key];
  });
}

// Board edits go through Supabase's REST layer, which describes itself.
export function openapi(e: Endpoints) {
  const u = endpoints(e);
  const session = {
    type: "object",
    properties: {
      access_token: { type: "string" },
      refresh_token: {
        type: "string",
        description: "Store it durably; each refresh returns a replacement to use next time",
      },
      expires_at: { type: "integer", description: "Unix seconds" },
    },
  };
  return {
    openapi: "3.0.3",
    info: {
      title: "Stash API",
      version: "1",
      description: `Sessions and instructions. The user's boards are read and written through the Supabase REST API at ${u.rest}, described at ${u.restOpenapi}, with a session.`,
    },
    externalDocs: { description: "The user's boards", url: u.restOpenapi },
    servers: [{ url: e.base }],
    components: {
      securitySchemes: {
        agentKey: {
          type: "http",
          scheme: "bearer",
          description: "An agent key the owner made under Agent keys; exchange it at /token",
        },
        session: {
          type: "http",
          scheme: "bearer",
          description: `A Supabase access token, valid until the session's expires_at. Refresh it: POST ${u.tokenRefresh} with header apikey: ${e.publishableKey} and JSON {"refresh_token"}.`,
        },
      },
      schemas: { Session: session },
    },
    paths: {
      "/signup": {
        post: {
          summary: "Create an account with an email and a password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: {
                      type: "string",
                      minLength: MIN_PASSWORD_LENGTH,
                      description:
                        "The user's choice. Leave it out and Stash makes one, returned once in the response.",
                    },
                  },
                  required: ["email"],
                },
              },
            },
          },
          responses: {
            "201": {
              description:
                "Account created: a session for the agent. The user signs in on the site with the email and password.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      password: {
                        type: "string",
                        description:
                          "Only when Stash made it. Give it to the user; it is not shown again.",
                      },
                      session,
                      api: { type: "object", description: "Every endpoint the agent needs" },
                    },
                  },
                },
              },
            },
            "400": { description: "No valid email, or a password that is too short" },
            "409": {
              description:
                "The email already has an account: the user signs in on the site and can make an agent key there",
            },
            "429": { description: "Too many sign-ups from this address" },
          },
        },
      },
      "/token": {
        post: {
          summary: "Exchange an agent key for a session",
          security: [{ agentKey: [] }],
          responses: {
            "200": {
              description: "A session for the key's owner; exchange the key again once it expires",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session,
                      api: { type: "object", description: "Every endpoint the agent needs" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unknown or revoked key" },
            "429": { description: "Too many attempts from this address" },
          },
        },
      },
      "/rest-openapi.json": {
        get: {
          summary: "Supabase's generated OpenAPI document for the boards table",
          responses: { "200": { description: "OpenAPI 2 (Swagger) from PostgREST" } },
        },
      },
      "/agent": {
        get: {
          summary: "Instructions for an agent working with Stash",
          responses: { "200": { description: "Markdown" } },
        },
      },
      "/image": {
        get: {
          summary: "A shared board's uploaded picture; a linked one is in the board's image",
          parameters: [
            {
              name: "token",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "The board's share_token",
            },
          ],
          responses: {
            "302": { description: "To a signed URL for the file, good for an hour" },
            "404": { description: "No shared board with that token, or no uploaded picture on it" },
          },
        },
      },
      "/openapi.json": {
        get: { summary: "This document", responses: { "200": { description: "OpenAPI" } } },
      },
    },
  };
}
