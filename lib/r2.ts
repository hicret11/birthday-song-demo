import { put } from "@vercel/blob";

/**
 * Upload a media object (audio/video/photo) and return its public https URL.
 *
 * Storage runs on **Vercel Blob**, provisioned via the `BLOB_READ_WRITE_TOKEN`
 * environment variable — no Cloudflare/R2 account required. The historical
 * `uploadToR2` name and signature are kept intentionally so the many existing
 * call sites (share create, audio cuts, preview cache, photos, slideshow) don't
 * change: pass a key + bytes + content type, get back a public URL to persist
 * and serve.
 *
 * Keys are used verbatim as the blob pathname (e.g. `audio/{id}-full.mp3`),
 * deterministic and overwritable so re-uploads (regenerate, preview caching)
 * replace the same object instead of erroring.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<string> {
  // `put` accepts string | Buffer directly; coerce Uint8Array → Buffer so the
  // body always matches an accepted PutBody type.
  const payload = typeof body === "string" ? body : Buffer.from(body);

  const { url } = await put(key, payload, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    // token is read from BLOB_READ_WRITE_TOKEN in the environment.
  });

  return url;
}
