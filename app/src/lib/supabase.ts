import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { SignUpRequest, SignUpResponse } from "@shared/api.ts";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : undefined;

export const API_BASE = `${SUPABASE_URL}/functions/v1/stash`;

/** Dev server only: signs in as the local dev account, which needs no email. */
export async function signInAsDevAccount() {
  const response = await fetch("/__dev/session");
  if (!response.ok) throw new Error(await response.text());
  const { error } = await supabase!.auth.setSession((await response.json()) as Session);
  if (error) throw error;
}

/** Through the function, as agents sign up: Supabase's own sign-up stays off, so the function's throttle covers every new account. */
export async function signUp(email: string, password: string) {
  const response = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password } satisfies SignUpRequest),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<SignUpResponse> & {
    error?: string;
  };
  if (!response.ok || !body.session)
    throw new Error(body.error ?? `Sign-up failed (${response.status})`);
  const { error } = await supabase!.auth.setSession(body.session);
  if (error) throw error;
}

/** Undefined until known; null when signed out. */
export type SessionState = Session | null | undefined;

export function useSession(): SessionState {
  const [session, setSession] = useState<SessionState>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
