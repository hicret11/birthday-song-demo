// Mint a crowd-magic gift BEFORE any song exists.
//
// POST /api/crowd/create  { recipientName, language, genre?, directorName? }
// Crowd mode inverts the normal order: the giver needs a shareable gift id up
// front so the birthday person's circle can add lines/memories via /join/[id]
// while the song is still just an idea. This route mints that id and persists a
// MINIMAL SharedSong to KV (recipient/language/genre + crowd.status="collecting"
// — no lyrics, no audio yet). The eventual merge step (Inngest, Phase 2b) fills
// in the song and flips crowd.status to "merged".
//
// Same guards as the contribute route: per-IP rate limit + moderation of the
// user-supplied names, since the recipient name surfaces on the contributor
// page (/join) and in the final song.

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";
import { generateShareId, saveCrowdDirectorToken, saveSharedSong } from "@/lib/share";
import { moderateShareInput } from "@/lib/moderation";
import { LANGUAGES, type Language, type SharedSong } from "@/lib/api-types";

export const runtime = "nodejs";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const MAX_NAME_LEN = 60;
// Stable per-browser identity for the giver. The gift records the token that
// minted it (server-side, out of band) so only that browser can later close it.
const DIRECTOR_COOKIE = "smb_director";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function cleanName(value: unknown, max: number): string {
  // Strip control characters (\p{Cc}) the same way the contribute route does,
  // then trim + clamp. Names surface publicly, so keep them tidy.
  return (typeof value === "string" ? value : "")
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, max);
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  try {
    const rate = await rateLimitFixedWindow(
      `rate:crowd-create:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
      { request, ip },
    );
    if (!rate.allowed) {
      return jsonError("RATE_LIMITED", "Too many group songs started — take a breath and try again soon.", 429);
    }
  } catch (err) {
    console.error("[crowd-create] rate-limit KV failure:", err);
  }

  let body: { recipientName?: unknown; language?: unknown; genre?: unknown; directorName?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  const recipientName = cleanName(body.recipientName, MAX_NAME_LEN);
  if (!recipientName) {
    return jsonError("INVALID_INPUT", "Add the birthday person's name to start a group song.", 400);
  }

  // Language drives the eventual lyric generation; only accept a known one.
  const language = typeof body.language === "string" ? body.language : "";
  if (!(LANGUAGES as readonly string[]).includes(language)) {
    return jsonError("INVALID_INPUT", "Pick a supported language.", 400);
  }

  const genre = cleanName(body.genre, 40);
  const directorName = cleanName(body.directorName, MAX_NAME_LEN) || undefined;

  // Moderation gate — the recipient name is public on /join and goes into the
  // song; the director name surfaces in the reveal credit.
  const mod = await moderateShareInput([recipientName, directorName]);
  if (!mod.allowed) {
    return jsonError("MODERATION", "That didn't pass our content check — try rephrasing.", 422);
  }

  // Stable director identity via a first-party cookie (mirrors the contributor
  // cookie). The gift records this token so only this browser can close it.
  const jar = await cookies();
  let directorToken = jar.get(DIRECTOR_COOKIE)?.value;
  let setCookie = false;
  if (!directorToken || directorToken.length < 8) {
    directorToken = randomUUID();
    setCookie = true;
  }

  const id = generateShareId();
  const song: SharedSong = {
    id,
    name: recipientName,
    language: language as Language,
    genre,
    // Minimal placeholders — no song exists yet. Required by the SharedSong
    // shape; the close/merge step overwrites these once the crowd song is made.
    lyrics: { title: "", sections: [], raw: "", style: "", language },
    audioUrl: "",
    template: "classic",
    createdAt: Date.now(),
    crowd: { status: "collecting", directorName },
  };

  try {
    await saveSharedSong(song);
    await saveCrowdDirectorToken(id, directorToken);
  } catch (err) {
    console.error("[crowd-create] KV save failure:", err);
    return jsonError("INTERNAL", "Couldn't start the group song just now — please try again.", 502);
  }

  const res = Response.json({ id, joinUrl: `/join/${id}` });
  if (setCookie) {
    res.headers.append(
      "Set-Cookie",
      `${DIRECTOR_COOKIE}=${directorToken}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; SameSite=Lax`,
    );
  }
  return res;
}
