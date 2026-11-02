// The stash function's requests and responses.

/** No reset by email, so a new one must be worth keeping. */
export const MIN_PASSWORD_LENGTH = 8;

export type ApiSession = { access_token: string; refresh_token: string; expires_at?: number };

/** `POST /signup`: a new account. Without a password, the function makes one. */
export type SignUpRequest = { email: string; password?: string };
export type SignUpResponse = {
  email: string;
  /** Only when the function made it; the user signs in with it. */
  password?: string;
  session: ApiSession;
  api: Record<string, string>;
};
