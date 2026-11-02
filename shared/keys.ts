// The browser makes keys and the function checks them; Web Crypto exists in every runtime here.

export const KEY_PREFIX = "sk_";
/** Characters shown in lists so the owner can tell keys apart. */
export const KEY_SHOWN = 8;

/** Random bytes as unpadded base64url. */
export function randomToken(bytes: number): string {
  const base64 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const newKey = (): string => KEY_PREFIX + randomToken(24);

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
