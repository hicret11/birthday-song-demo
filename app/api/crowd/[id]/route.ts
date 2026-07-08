// Crowd-magic gift snapshot for the contributor page.
//
// GET /api/crowd/[id]
// Returns only what a contributor is allowed to see: the recipient's first
// name (to personalize the ask), the count, and the approved contributions
// (author name + text, plus any contributor photo URLs — those are public
// participation media, not the gift). NO gift media: no paywall/unlock state,
// no song audio/video — contributors are not buyers and never receive it.

import { loadSharedSong } from "@/lib/share";
import { listApprovedContributions } from "@/lib/crowd";

export const runtime = "nodejs";

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id || !ID_RE.test(id)) {
    return Response.json({ error: { code: "INVALID_INPUT", message: "Invalid gift id." } }, { status: 400 });
  }

  const song = await loadSharedSong(id);
  if (!song) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "This gift link isn't valid or has expired." } },
      { status: 404 },
    );
  }

  const contributions = await listApprovedContributions(id);

  return Response.json({
    recipientName: song.name,
    language: song.language,
    count: contributions.length,
    contributions: contributions.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      kind: c.kind,
      content: c.content,
      contentUrl: c.contentUrl,
      createdAt: c.createdAt,
    })),
  });
}
