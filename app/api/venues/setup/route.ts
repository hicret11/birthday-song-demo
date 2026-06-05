import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { HEX_COLOR_RE, randomSlugSuffix, slugify } from "@/lib/venues";

export const runtime = "nodejs";

const MAX_NAME_LEN = 80;
const MAX_SLUG_RETRIES = 4;

type SetupBody = {
  session_id?: unknown;
  venue_name?: unknown;
  logo_color?: unknown;
};

function bad(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: SetupBody;
  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return bad("Request body must be valid JSON.", 400);
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  if (!sessionId.startsWith("cs_")) return bad("Missing or invalid session_id.", 400);

  const venueName = typeof body.venue_name === "string" ? body.venue_name.trim() : "";
  if (!venueName) return bad("Venue name is required.", 400);
  if (venueName.length > MAX_NAME_LEN) return bad("Venue name is too long.", 400);

  const logoColor = typeof body.logo_color === "string" ? body.logo_color.trim() : "";
  if (!HEX_COLOR_RE.test(logoColor)) return bad("Logo color must be a #RRGGBB hex value.", 400);

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return bad("Could not verify checkout session.", 400);
  }

  if (session.payment_status !== "paid") {
    return bad("Checkout is not complete.", 402);
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (!customerId) return bad("Checkout session has no customer.", 400);

  const email = session.customer_details?.email ?? session.customer_email ?? "";
  if (!email) return bad("Checkout session has no email.", 400);

  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupErr } = await supabase
    .from("venues")
    .select("id, share_slug")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (lookupErr) {
    console.error("[venues-setup] lookup failed:", lookupErr);
    return bad("Couldn't read venue. Please try again.", 500);
  }

  if (existing?.share_slug) {
    return Response.json({ ok: true, slug: existing.share_slug, alreadyOnboarded: true });
  }

  const baseSlug = slugify(venueName) || "venue";
  let slug = baseSlug;
  let attempts = 0;

  while (attempts < MAX_SLUG_RETRIES) {
    const nowIso = new Date().toISOString();
    const { error } = existing
      ? await supabase
          .from("venues")
          .update({ venue_name: venueName, logo_color: logoColor, share_slug: slug, updated_at: nowIso })
          .eq("stripe_customer_id", customerId)
      : await supabase.from("venues").insert({
          stripe_customer_id: customerId,
          email,
          subscription_status: "incomplete",
          venue_name: venueName,
          logo_color: logoColor,
          share_slug: slug,
          updated_at: nowIso,
        });

    if (!error) {
      return Response.json({ ok: true, slug });
    }
    if (error.code === "23505") {
      slug = `${baseSlug}-${randomSlugSuffix(4)}`;
      attempts += 1;
      continue;
    }
    console.error("[venues-setup] write failed:", error);
    return bad("Couldn't save venue. Please try again.", 500);
  }

  return bad("Couldn't find an available slug. Try a slightly different venue name.", 409);
}
