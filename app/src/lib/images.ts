import { IMAGE_BUCKET, IMAGE_MAX_BYTES, IMAGE_TYPES } from "@shared/tables.ts";
import { supabase } from "./supabase.ts";

/** Signed URLs outlive a tab's typical stay; the boards reload on return mints fresh ones. */
export const SIGNED_URL_SECONDS = 3600;

const bucket = () => supabase!.storage.from(IMAGE_BUCKET);

/** Puts the file in the owner's folder under a fresh name and returns its path. */
export async function uploadImage(owner: string, file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG, GIF, WebP or AVIF.");
  if (file.size > IMAGE_MAX_BYTES) throw new Error("Pictures may be up to 5 MB.");
  const path = `${owner}/${crypto.randomUUID()}`;
  const { error } = await bucket().upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

/** Best effort: a file that outlives its board costs space, not correctness. */
export const removeImage = (path: string) =>
  bucket()
    .remove([path])
    .then(
      () => undefined,
      () => undefined,
    );

export async function signImages(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await bucket().createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : [])),
  );
}
