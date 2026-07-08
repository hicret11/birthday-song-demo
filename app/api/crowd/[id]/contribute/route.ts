// Add a crowd-magic contribution to a gift.
//
// POST /api/crowd/[id]/contribute  { kind, content | content_url, authorName? }
// - id = KV share id of the gift (must exist).
// - Anonymous contributor identity via a first-party cookie (no login).
// - Rate-limited per IP; per-author cap; every text runs through moderation
//   (same gate the share input uses) BEFORE it's stored, because contributions
//   surface publicly on the contributor page and in the final song.
//
// Text contributions (line / memory / wish) carry `content`; a media
// contribution (`photo` / `voice`) instead carries a `content_url` — a file
// already uploaded via /api/photos/upload or /api/audio/upload (Vercel Blob).
// Media kinds skip text moderation (no text of their own) but still run
// author-name moderation. A voice note's spoken words are transcribed +
// folded into the lyrics later, at merge time (see /api/crowd/[id]/close).

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { crowdChannelName, CROWD_CONTRIBUTION_EVENT } from "@/lib/crowd-realtime";
import { loadSharedSong } from "@/lib/share";
import { moderateShareInput } from "@/lib/moderation";
import {
  addContribution,
  countByAuthor,
  MAX_CONTRIBUTION_LEN,
  MAX_PER_AUTHOR,
  type ContributionKind,
} from "@/lib/crowd";

export const runtime = "nodejs";

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;
const CONTRIBUTOR_COOKIE = "smb_contributor";
const TEXT_KINDS: ContributionKind[] = ["line", "memory", "wish"];
// Media kinds carry an already-uploaded content_url instead of text (photo →
// /api/photos/upload, voice → /api/audio/upload) and skip content moderation.
const MEDIA_KINDS: ContributionKind[] = ["photo", "voice"];
const ALLOWED_KINDS: ContributionKind[] = [...TEXT_KINDS, ...MEDIA_KINDS];

// A media URL must be a well-formed https URL. Storage is Vercel Blob
// (uploadToR2 → *.public.blob.vercel-storage.com), but we don't hardcode that
// host — just require https so we never store a javascript:/data: URL.
function isValidMediaUrl(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function stripControl(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F]/g, "");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id || !ID_RE.test(id)) {
    return jsonError("INVALID_INPUT", "Invalid gift id.", 400);
  }

  const ip = getClientIp(request);
  try {
    const rate = await rateLimitFixedWindow(
      `rate:crowd:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip },
    );
    if (!rate.allowed) {
      return jsonError("RATE_LIMITED", "Too many additions — take a breath and try again soon.", 429);
    }
  } catch (err) {
    console.error("[crowd-contribute] rate-limit KV failure:", err);
  }

  // The gift must exist (song lives in KV). We don't leak any of its media —
  // only that it exists — so contributors can add to a real gift.
  const song = await loadSharedSong(id);
  if (!song) return jsonError("NOT_FOUND", "This gift link isn't valid or has expired.", 404);

  let body: {
    kind?: unknown;
    content?: unknown;
    content_url?: unknown;
    contentUrl?: unknown;
    authorName?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  const kind = (typeof body.kind === "string" ? body.kind : "line") as ContributionKind;
  if (!ALLOWED_KINDS.includes(kind)) {
    return jsonError("INVALID_INPUT", "Unsupported contribution kind.", 400);
  }
  const isMedia = MEDIA_KINDS.includes(kind);

  // Text kinds carry `content`; a media kind (photo/voice) carries `content_url`
  // (already uploaded to Vercel Blob).
  let content: string | null = null;
  let contentUrl: string | null = null;
  if (isMedia) {
    const rawUrl =
      typeof body.content_url === "string"
        ? body.content_url
        : typeof body.contentUrl === "string"
          ? body.contentUrl
          : "";
    contentUrl = rawUrl.trim();
    if (!contentUrl || !isValidMediaUrl(contentUrl)) {
      return jsonError(
        "INVALID_INPUT",
        kind === "voice"
          ? "A voice note needs a valid uploaded audio URL."
          : "A photo needs a valid uploaded image URL.",
        400,
      );
    }
  } else {
    content = stripControl(typeof body.content === "string" ? body.content : "")
      .trim()
      .slice(0, MAX_CONTRIBUTION_LEN);
    if (!content) {
      return jsonError("INVALID_INPUT", "Add a few words before sending.", 400);
    }
  }

  const authorName = stripControl(typeof body.authorName === "string" ? body.authorName : "")
    .trim()
    .slice(0, 60) || null;

  // Anonymous, stable contributor identity via a first-party cookie.
  const jar = await cookies();
  let token = jar.get(CONTRIBUTOR_COOKIE)?.value;
  let setCookie = false;
  if (!token || token.length < 8) {
    token = randomUUID();
    setCookie = true;
  }

  // Per-author cap so one person can't flood a gift.
  const already = await countByAuthor(id, token);
  if (already >= MAX_PER_AUTHOR) {
    return jsonError(
      "LIMIT_REACHED",
      `You've already added ${MAX_PER_AUTHOR} — thank you! Let others add theirs too.`,
      429,
    );
  }

  // Moderation gate — contributions are public + go into the song. A media
  // contribution (photo/voice) has no text of its own, so only its author name
  // is moderated; text kinds moderate both content and author name. (A voice
  // note's transcript is produced + moderated separately at merge time.)
  const mod = await moderateShareInput(isMedia ? [authorName] : [content, authorName]);
  if (!mod.allowed) {
    return jsonError("MODERATION", "That didn't pass our content check — try rephrasing.", 422);
  }

  const created = await addContribution({
    giftId: id,
    authorToken: token,
    authorName,
    kind,
    content,
    contentUrl,
    status: "approved",
  });
  if (!created) {
    return jsonError("INTERNAL", "Couldn't save that just now — please try again.", 502);
  }

  // Live fan-out to everyone on the /join page (Supabase Realtime Broadcast).
  // Best-effort: a broadcast failure must NEVER fail the request — the
  // contribution is already saved, and the 30s poll fallback catches it.
  try {
    const admin = getSupabaseAdmin();
    const channel = admin.channel(crowdChannelName(id));
    await channel.send({
      type: "broadcast",
      event: CROWD_CONTRIBUTION_EVENT,
      payload: {
        id: created.id,
        authorName: created.authorName,
        kind: created.kind,
        content: created.content,
        contentUrl: created.contentUrl,
      },
    });
    await admin.removeChannel(channel);
  } catch (err) {
    console.warn("[crowd-contribute] realtime broadcast failed (non-fatal):", err);
  }

  const res = Response.json({
    ok: true,
    contribution: {
      id: created.id,
      authorName: created.authorName,
      kind: created.kind,
      content: created.content,
      contentUrl: created.contentUrl,
      createdAt: created.createdAt,
    },
  });
  if (setCookie) {
    res.headers.append(
      "Set-Cookie",
      `${CONTRIBUTOR_COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; SameSite=Lax`,
    );
  }
  return res;
}
