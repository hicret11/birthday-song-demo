import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";
import type { ShareTemplate } from "./api-types";
import { renderShareVideo } from "./video";

const PREVIEW_TTL_SECONDS = 24 * 60 * 60;
const SUNO_HASH_PATTERN = /tempfile\.aiquickdraw\.com\/r\/([a-f0-9]{32})\.mp3/i;

type CachedPreview = { videoUrl: string; createdAt: number };

function audioHash(audioUrl: string): string {
  const match = audioUrl.match(SUNO_HASH_PATTERN);
  if (match) return match[1];
  return createHash("sha256").update(audioUrl).digest("hex").slice(0, 32);
}

function previewKey(hash: string, template: ShareTemplate): string {
  return `preview:${hash}:${template}`;
}

function previewBlobPath(hash: string, template: ShareTemplate): string {
  return `previews/${hash}-${template}.mp4`;
}

export async function getCachedPreviewUrl(
  audioUrl: string,
  template: ShareTemplate,
): Promise<string | null> {
  const cached = await kv.get<CachedPreview>(previewKey(audioHash(audioUrl), template));
  return cached?.videoUrl ?? null;
}

export async function renderAndCachePreview(args: {
  audioUrl: string;
  name: string;
  template: ShareTemplate;
}): Promise<string> {
  const hash = audioHash(args.audioUrl);
  const key = previewKey(hash, args.template);

  const cached = await kv.get<CachedPreview>(key);
  if (cached?.videoUrl) return cached.videoUrl;

  const rendered = await renderShareVideo({
    audioUrl: args.audioUrl,
    name: args.name,
    template: args.template,
  });

  const blob = await put(previewBlobPath(hash, args.template), rendered.mp4, {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await kv.set(
    key,
    { videoUrl: blob.url, createdAt: Date.now() } satisfies CachedPreview,
    { ex: PREVIEW_TTL_SECONDS },
  );

  return blob.url;
}
