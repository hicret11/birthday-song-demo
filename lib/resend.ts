import { Resend } from "resend";

const DEFAULT_FROM = "Sing My Birthday <onboarding@resend.dev>";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const BRAND_PINK = "#ec4899";
const BRAND_PURPLE = "#a855f7";
const BRAND_AMBER = "#f59e0b";
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_PINK} 0%, ${BRAND_PURPLE} 50%, ${BRAND_AMBER} 100%)`;
const LOGO_MARK_URL = "https://singmybirthday.com/brand/logo-mark.png";
const LOGO_MARK_WHITE_URL = "https://singmybirthday.com/brand/logo-mark-white.png";
const LOGO_LOCKUP_URL = "https://singmybirthday.com/brand/logo-lockup.png";
const UNSUBSCRIBE_MAILTO = "mailto:info@singmybirthday.com?subject=Unsubscribe";

let cached: Resend | null = null;

function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

function fromAddress(): string {
  const env = process.env.RESEND_FROM_EMAIL?.trim();
  return env && env.length > 0 ? env : DEFAULT_FROM;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SongReadyEmailProps = {
  to: string;
  shareUrl: string;
  recipientName: string;
  senderName?: string;
  venueName?: string;
  venueColor?: string;
  origin: string;
};

function buildShareMessage(props: SongReadyEmailProps): string {
  if (props.senderName) {
    return `${props.senderName} made you a birthday song \u{1F382} ${props.shareUrl}`;
  }
  return `A birthday song for ${props.recipientName} \u{1F382} ${props.shareUrl}`;
}

function buildSubject(props: SongReadyEmailProps): string {
  if (props.senderName) {
    return `🎂 ${props.senderName} made a birthday song for ${props.recipientName}!`;
  }
  return `🎂 ${props.recipientName}'s birthday song is ready`;
}

function buildHtml(props: SongReadyEmailProps): string {
  const recipient = escapeHtml(props.recipientName);
  const sender = props.senderName ? escapeHtml(props.senderName) : "";
  const venue = props.venueName ? escapeHtml(props.venueName) : "";
  const venueColor =
    props.venueColor && HEX_COLOR_RE.test(props.venueColor) ? props.venueColor : BRAND_PURPLE;
  const shareUrl = props.shareUrl;
  const shareMessage = buildShareMessage(props);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const smsUrl = `sms:?body=${encodeURIComponent(shareMessage)}`;

  // Hidden preheader: first ~100 chars shown in inbox previews. Padded with
  // zero-width characters so other body content can't leak into the preview.
  const preheader = "Open to hear it — and send it their way 🎵";
  const preheaderPad = "&#847; &zwnj; &nbsp; &#8199; &#65279; ".repeat(20);

  const venueRow = venue
    ? `
              <tr>
                <td align="center" style="padding:0 32px 6px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">
                  <span style="color:#6b7280;">From </span><span style="color:${venueColor};">${venue}</span>
                </td>
              </tr>`
    : "";

  const senderLine = sender
    ? `
              <tr>
                <td align="center" style="padding:6px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#4b5563;">
                  ${sender} made it just for them.
                </td>
              </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(buildSubject(props))}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;">
    <!-- Preheader (inbox preview text). Hidden visually. -->
    <div style="display:none;font-size:1px;color:#f5f3ff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${preheader} ${preheaderPad}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f3ff" style="background-color:#f5f3ff;padding:32px 0;">
      <tr>
        <td align="center">

          <!-- Outer card -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">

            <!-- Header: brand gradient (with solid fallback) + logo + wordmark -->
            <tr>
              <td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};padding:28px 32px;text-align:center;">
                <img src="${LOGO_MARK_WHITE_URL}" alt="" width="100" height="100" style="display:inline-block;border:0;outline:none;height:100px;width:100px;vertical-align:middle;" />
                <span style="display:inline-block;margin-left:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:0.2px;color:#ffffff;vertical-align:middle;line-height:100px;">
                  Sing My Birthday
                </span>
              </td>
            </tr>

            ${venueRow ? "" : ""}${venueRow}

            <!-- Headline -->
            <tr>
              <td align="center" style="padding:${venue ? "12" : "32"}px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:26px;line-height:1.2;font-weight:800;color:#0f172a;">
                ${recipient}'s birthday song is ready!
              </td>
            </tr>

            ${senderLine}

            <!-- Subhead -->
            <tr>
              <td align="center" style="padding:14px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#4b5563;">
                Take a listen, then send it their way.
              </td>
            </tr>

            <!-- Primary CTA: 44px+ tap target, gradient with solid fallback -->
            <tr>
              <td align="center" style="padding:26px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};border-radius:14px;">
                      <a href="${shareUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px;line-height:1;">
                        🎵 Play the Song
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Share affordances -->
            <tr>
              <td align="center" style="padding:18px 32px 4px 32px;">
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.7;color:#6b7280;">
                  <span style="color:#9ca3af;">Forward this email</span>
                  <span style="color:#d1d5db;">&nbsp;·&nbsp;</span>
                  <a href="${waUrl}" target="_blank" rel="noopener" style="color:${BRAND_PURPLE};text-decoration:none;font-weight:600;">Send by WhatsApp</a>
                  <span style="color:#d1d5db;">&nbsp;·&nbsp;</span>
                  <a href="${smsUrl}" style="color:${BRAND_PURPLE};text-decoration:none;font-weight:600;">Send by SMS</a>
                </p>
              </td>
            </tr>

            <!-- Copyable link -->
            <tr>
              <td align="center" style="padding:8px 32px 28px 32px;">
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#9ca3af;word-break:break-all;">
                  Or copy: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Viral hook -->
            <tr>
              <td bgcolor="#fdf4ff" style="background-color:#fdf4ff;padding:22px 32px;border-top:1px solid #f3e8ff;text-align:center;">
                <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;font-weight:600;color:#0f172a;">
                  Got someone else with a birthday coming up?
                </p>
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#4b5563;">
                  <a href="https://singmybirthday.com/" target="_blank" rel="noopener" style="color:${BRAND_PURPLE};text-decoration:none;font-weight:700;">
                    Make them their own song →
                  </a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:24px 32px 28px 32px;border-top:1px solid #f3f4f6;">
                <img src="${LOGO_LOCKUP_URL}" alt="" width="180" height="140" style="display:block;margin:0 auto 12px auto;border:0;outline:none;opacity:0.9;" />
                <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#4b5563;">
                  Made with love by Sing My Birthday
                </p>
                <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#6b7280;">
                  Sing My Birthday <span style="color:#d1d5db;">·</span> A glomotec Labs product
                </p>
                <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af;">
                  Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801
                </p>
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#9ca3af;">
                  <a href="${UNSUBSCRIBE_MAILTO}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(props: SongReadyEmailProps): string {
  const lines: string[] = [];
  lines.push("Sing My Birthday");
  lines.push("");
  if (props.venueName) lines.push(`From ${props.venueName}`);
  lines.push(`${props.recipientName}'s birthday song is ready!`);
  if (props.senderName) lines.push(`${props.senderName} made it just for them.`);
  lines.push("Take a listen, then send it their way.");
  lines.push("");
  lines.push(`Play the Song: ${props.shareUrl}`);
  lines.push("");
  lines.push("Share it:");
  lines.push("  · Forward this email");
  lines.push(`  · WhatsApp: https://wa.me/?text=${encodeURIComponent(buildShareMessage(props))}`);
  lines.push(`  · SMS:      sms:?body=${encodeURIComponent(buildShareMessage(props))}`);
  lines.push("");
  lines.push("---");
  lines.push("Got someone else with a birthday coming up?");
  lines.push("Make them their own song: https://singmybirthday.com");
  lines.push("");
  lines.push("Made with love by Sing My Birthday");
  lines.push("Sing My Birthday · A glomotec Labs product");
  lines.push(
    "Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801",
  );
  lines.push(`Unsubscribe: ${UNSUBSCRIBE_MAILTO}`);
  return lines.join("\n");
}

type ResendSendPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  tags: { name: string; value: string }[];
};

// Status codes worth retrying. 4xx are deterministic (bad key, invalid recipient,
// rejected sender domain) — retrying won't change the outcome.
function isRetryableStatus(code: number): boolean {
  return code === 0 || code === 408 || code === 429 || code >= 500;
}

function delayMsForAttempt(attempt: number): number {
  // 3 attempts total. Wait BEFORE retry #2 = 3s, BEFORE retry #3 = 9s.
  if (attempt === 1) return 3_000;
  return 9_000;
}

function failureContext(props: SongReadyEmailProps): Record<string, unknown> {
  return {
    to: props.to,
    shareUrl: props.shareUrl,
    recipientName: props.recipientName,
    senderName: props.senderName ?? null,
    venueName: props.venueName ?? null,
  };
}

async function trySendOnce(
  client: Resend,
  payload: ResendSendPayload,
): Promise<{ ok: true; id: string } | { ok: false; retryable: boolean; reason: string }> {
  try {
    const result = await client.emails.send(payload);
    if (result.error) {
      const code = (result.error as { statusCode?: number }).statusCode ?? 0;
      const reason = `${code || "?"} ${result.error.name ?? ""} ${result.error.message ?? ""}`.trim();
      return { ok: false, retryable: isRetryableStatus(code), reason };
    }
    return { ok: true, id: result.data?.id ?? "?" };
  } catch (err) {
    // Network-layer failure — treat as retryable.
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, retryable: true, reason };
  }
}

// ── Venue portal-link email ──────────────────────────────────────────────
// Sent when a venue owner requests "Manage subscription" from /v/[slug]/manage.

export type PortalLinkEmailProps = {
  to: string;
  venueName: string;
  portalUrl: string;
};

function buildPortalLinkHtml(props: PortalLinkEmailProps): string {
  const venue = escapeHtml(props.venueName);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Manage your subscription</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f3ff" style="padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
        <tr><td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};padding:24px;text-align:center;">
          <img src="${LOGO_MARK_WHITE_URL}" alt="" width="56" height="56" style="display:inline-block;border:0;vertical-align:middle;" />
          <span style="display:inline-block;margin-left:12px;font-size:22px;font-weight:800;color:#fff;vertical-align:middle;line-height:56px;">Sing My Birthday</span>
        </td></tr>
        <tr><td align="center" style="padding:28px 28px 8px 28px;font-size:22px;font-weight:800;color:#0f172a;">
          Manage ${venue}'s subscription
        </td></tr>
        <tr><td align="center" style="padding:12px 28px 0 28px;font-size:14px;line-height:1.5;color:#4b5563;">
          You (or someone with your email) requested a link to manage your Sing My Birthday subscription. Click below to update your card, see invoices, or cancel.
        </td></tr>
        <tr><td align="center" style="padding:22px 28px 8px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};border-radius:14px;">
              <a href="${props.portalUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:#fff;text-decoration:none;border-radius:14px;line-height:1;">
                Manage subscription
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0 0;font-size:11px;color:#9ca3af;">This link expires in 30 minutes and can only be used once.</p>
        </td></tr>
        <tr><td align="center" style="padding:18px 28px 4px 28px;font-size:11px;color:#9ca3af;">
          If you didn't request this, you can safely ignore this email.
        </td></tr>
        <tr><td align="center" style="padding:18px 28px 24px 28px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
          Sing My Birthday <span style="color:#d1d5db;">·</span> A glomotec Labs product<br/>
          Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildPortalLinkText(props: PortalLinkEmailProps): string {
  return [
    `Manage ${props.venueName}'s subscription`,
    "",
    "You (or someone with your email) requested a link to manage your Sing My Birthday subscription.",
    "",
    `Manage: ${props.portalUrl}`,
    "",
    "This link expires in 30 minutes and can only be used once.",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "Sing My Birthday · A glomotec Labs product",
    "Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801",
  ].join("\n");
}

export async function sendPortalLinkEmail(props: PortalLinkEmailProps): Promise<void> {
  try {
    const client = getResend();
    if (!client) {
      console.warn("[resend] RESEND_API_KEY not set; portal-link not sent");
      return;
    }
    const result = await client.emails.send({
      from: fromAddress(),
      to: props.to,
      subject: `Manage your ${props.venueName} subscription`,
      html: buildPortalLinkHtml(props),
      text: buildPortalLinkText(props),
      tags: [{ name: "category", value: "portal_link" }],
    });
    if (result.error) {
      console.error("[resend] portal-link send returned error", result.error);
      return;
    }
    console.log(`[resend] portal-link sent ${result.data?.id ?? "?"} to ${props.to}`);
  } catch (err) {
    console.error("[resend] portal-link send failed", err);
  }
}

// ── Dunning email (invoice.payment_failed) ──────────────────────────────────

export type DunningEmailProps = {
  to: string;
  venueName: string;
  shareSlug: string;
  portalUrl: string;
};

function buildDunningHtml(props: DunningEmailProps): string {
  const venue = escapeHtml(props.venueName);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Payment failed</title></head>
<body style="margin:0;padding:0;background:#fff7ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#fff7ed" style="padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
        <tr><td bgcolor="#b91c1c" style="background-color:#b91c1c;padding:24px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#fff;">⚠️  Payment didn't go through</span>
        </td></tr>
        <tr><td align="center" style="padding:24px 28px 8px 28px;font-size:18px;font-weight:700;color:#0f172a;">
          ${venue} — your card was declined
        </td></tr>
        <tr><td align="center" style="padding:12px 28px 0 28px;font-size:14px;line-height:1.55;color:#4b5563;">
          Your branded link <a href="https://singmybirthday.com/v/${escapeHtml(props.shareSlug)}" style="color:${BRAND_PURPLE};">/v/${escapeHtml(props.shareSlug)}</a> is still live for the next few days, but if we can't charge the card on file we'll have to suspend it.
        </td></tr>
        <tr><td align="center" style="padding:22px 28px 6px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#b91c1c" style="background-color:#b91c1c;border-radius:14px;">
              <a href="${props.portalUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:#fff;text-decoration:none;border-radius:14px;line-height:1;">
                Update your card
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0 0;font-size:11px;color:#9ca3af;">This link goes straight to your secure Stripe billing portal. Expires in 24 hours.</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 28px 24px 28px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
          Sing My Birthday <span style="color:#d1d5db;">·</span> A glomotec Labs product<br/>
          Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildDunningText(props: DunningEmailProps): string {
  return [
    `⚠️ Payment didn't go through — ${props.venueName}`,
    "",
    `Your card was declined. Your branded link /v/${props.shareSlug} is still live for the next few days, but if we can't charge the card on file we'll have to suspend it.`,
    "",
    `Update your card: ${props.portalUrl}`,
    "",
    "This link goes straight to your secure Stripe billing portal. Expires in 24 hours.",
    "",
    "Sing My Birthday · A glomotec Labs product",
    "Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801",
  ].join("\n");
}

export async function sendDunningEmail(props: DunningEmailProps): Promise<void> {
  try {
    const client = getResend();
    if (!client) {
      console.warn("[resend] RESEND_API_KEY not set; dunning not sent");
      return;
    }
    const result = await client.emails.send({
      from: fromAddress(),
      to: props.to,
      subject: `⚠️ Update your card to keep ${props.venueName} live on Sing My Birthday`,
      html: buildDunningHtml(props),
      text: buildDunningText(props),
      tags: [{ name: "category", value: "dunning" }],
    });
    if (result.error) {
      console.error("[resend] dunning send returned error", result.error);
      return;
    }
    console.log(`[resend] dunning sent ${result.data?.id ?? "?"} to ${props.to}`);
  } catch (err) {
    console.error("[resend] dunning send failed", err);
  }
}

// ── Consumer login magic-link email ─────────────────────────────────────────
// Sent when someone asks to see "My Songs". Passwordless: clicking the link
// signs them in. Always send a generic message (never reveal whether the email
// has songs) and keep the link short-lived + single-use.

export type LoginLinkEmailProps = {
  to: string;
  loginUrl: string;
};

function buildLoginLinkHtml(props: LoginLinkEmailProps): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Your sign-in link</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f3ff" style="padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
        <tr><td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};padding:24px;text-align:center;">
          <img src="${LOGO_MARK_WHITE_URL}" alt="" width="56" height="56" style="display:inline-block;border:0;vertical-align:middle;" />
          <span style="display:inline-block;margin-left:12px;font-size:22px;font-weight:800;color:#fff;vertical-align:middle;line-height:56px;">Sing My Birthday</span>
        </td></tr>
        <tr><td align="center" style="padding:28px 28px 8px 28px;font-size:22px;font-weight:800;color:#0f172a;">
          Your sign-in link
        </td></tr>
        <tr><td align="center" style="padding:12px 28px 0 28px;font-size:14px;line-height:1.5;color:#4b5563;">
          Click below to sign in and see your birthday songs. No password needed.
        </td></tr>
        <tr><td align="center" style="padding:22px 28px 8px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};border-radius:14px;">
              <a href="${props.loginUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:#fff;text-decoration:none;border-radius:14px;line-height:1;">
                Sign in to Sing My Birthday
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0 0;font-size:11px;color:#9ca3af;">This link expires in 30 minutes and can only be used once.</p>
        </td></tr>
        <tr><td align="center" style="padding:18px 28px 4px 28px;font-size:11px;color:#9ca3af;">
          If you didn't request this, you can safely ignore this email.
        </td></tr>
        <tr><td align="center" style="padding:18px 28px 24px 28px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
          Sing My Birthday <span style="color:#d1d5db;">·</span> A glomotec Labs product<br/>
          Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildLoginLinkText(props: LoginLinkEmailProps): string {
  return [
    "Your Sing My Birthday sign-in link",
    "",
    "Click to sign in and see your birthday songs (no password needed):",
    props.loginUrl,
    "",
    "This link expires in 30 minutes and can only be used once.",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "Sing My Birthday · A glomotec Labs product",
    "Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801",
  ].join("\n");
}

export async function sendLoginLinkEmail(props: LoginLinkEmailProps): Promise<void> {
  try {
    const client = getResend();
    if (!client) {
      console.warn("[resend] RESEND_API_KEY not set; login-link not sent");
      return;
    }
    const result = await client.emails.send({
      from: fromAddress(),
      to: props.to,
      subject: "Your Sing My Birthday sign-in link",
      html: buildLoginLinkHtml(props),
      text: buildLoginLinkText(props),
      tags: [{ name: "category", value: "login_link" }],
    });
    if (result.error) {
      console.error("[resend] login-link send returned error", result.error);
      return;
    }
    console.log(`[resend] login-link sent ${result.data?.id ?? "?"} to ${props.to}`);
  } catch (err) {
    console.error("[resend] login-link send failed", err);
  }
}

// ── Abandoned-preview unlock-reminder email ─────────────────────────────────
// Sent by the recover-previews cron to people who created a song + heard the
// 15-second preview but did NOT pay to unlock. Up to 3 reminders, escalating
// in tone. `stage` (1, 2, or 3) drives the subject + copy. Best-effort: any
// failure is caught and logged, never thrown.

export type UnlockReminderEmailProps = {
  to: string;
  recipientName: string;
  shareUrl: string;
  /** Which reminder this is: 1 = gentle, 2 = value, 3 = final nudge. */
  stage: number;
};

type UnlockReminderCopy = {
  subject: string;
  preheader: string;
  headline: string;
  body: string;
  cta: string;
};

function unlockReminderCopy(name: string, stage: number): UnlockReminderCopy {
  if (stage <= 1) {
    return {
      subject: `🎵 ${name}'s song is ready — hear the full version`,
      preheader: "Your preview was just the start — unlock the whole song 🎶",
      headline: `${name}'s song is waiting`,
      body: `You heard the preview — the full song is even better. Unlock it now to play the complete version, download the MP3, and send it their way.`,
      cta: "Hear the full song →",
    };
  }
  if (stage === 2) {
    return {
      subject: `🎶 Don't let ${name}'s song slip away`,
      preheader: "Full song, MP3 download, and the shareable video — all in one unlock.",
      headline: `${name}'s song is still ready for you`,
      body: `Unlocking gives you the complete song, a downloadable MP3, and the branded video you can text, WhatsApp, or post — everything you need to make their day. It only takes a moment.`,
      cta: "Unlock the full song →",
    };
  }
  return {
    subject: `⏳ Last chance to unlock ${name}'s song`,
    preheader: "Your song link won't stay up forever — unlock it before it's gone.",
    headline: `Last chance for ${name}'s song`,
    body: `This is the final reminder — your song link won't stay up forever. Unlock now to get the full version, the MP3, and the shareable video before it's gone.`,
    cta: "Unlock it now →",
  };
}

function buildUnlockReminderHtml(props: UnlockReminderEmailProps): string {
  const name = escapeHtml(props.recipientName);
  const copy = unlockReminderCopy(name, props.stage);
  const shareUrl = props.shareUrl;
  const preheaderPad = "&#847; &zwnj; &nbsp; &#8199; &#65279; ".repeat(20);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;font-size:1px;color:#f5f3ff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${copy.preheader} ${preheaderPad}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f3ff" style="background-color:#f5f3ff;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">

            <!-- Header: brand gradient + logo + wordmark -->
            <tr>
              <td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};padding:28px 32px;text-align:center;">
                <img src="${LOGO_MARK_WHITE_URL}" alt="" width="64" height="64" style="display:inline-block;border:0;outline:none;height:64px;width:64px;vertical-align:middle;" />
                <span style="display:inline-block;margin-left:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:0.2px;color:#ffffff;vertical-align:middle;line-height:64px;">
                  Sing My Birthday
                </span>
              </td>
            </tr>

            <!-- Headline -->
            <tr>
              <td align="center" style="padding:30px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:25px;line-height:1.25;font-weight:800;color:#0f172a;">
                ${copy.headline}
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td align="center" style="padding:14px 36px 0 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#4b5563;">
                ${copy.body}
              </td>
            </tr>

            <!-- Primary CTA -->
            <tr>
              <td align="center" style="padding:28px 32px 10px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};border-radius:14px;">
                      <a href="${shareUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 38px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px;line-height:1;">
                        ${copy.cta}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Copyable link -->
            <tr>
              <td align="center" style="padding:8px 32px 28px 32px;">
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#9ca3af;word-break:break-all;">
                  Or copy: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:24px 32px 28px 32px;border-top:1px solid #f3f4f6;">
                <img src="${LOGO_LOCKUP_URL}" alt="" width="150" height="116" style="display:block;margin:0 auto 12px auto;border:0;outline:none;opacity:0.9;" />
                <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#4b5563;">
                  Made with love by Sing My Birthday
                </p>
                <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#6b7280;">
                  Sing My Birthday <span style="color:#d1d5db;">·</span> A glomotec Labs product
                </p>
                <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af;">
                  Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801
                </p>
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#9ca3af;">
                  <a href="${UNSUBSCRIBE_MAILTO}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildUnlockReminderText(props: UnlockReminderEmailProps): string {
  const copy = unlockReminderCopy(props.recipientName, props.stage);
  return [
    "Sing My Birthday",
    "",
    copy.headline,
    "",
    copy.body,
    "",
    `${copy.cta} ${props.shareUrl}`,
    "",
    "---",
    "Made with love by Sing My Birthday",
    "Sing My Birthday · A glomotec Labs product",
    "Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801",
    `Unsubscribe: ${UNSUBSCRIBE_MAILTO}`,
  ].join("\n");
}

export async function sendUnlockReminderEmail(props: UnlockReminderEmailProps): Promise<void> {
  try {
    const client = getResend();
    if (!client) {
      console.warn("[resend] RESEND_API_KEY not set; unlock-reminder not sent");
      return;
    }
    const copy = unlockReminderCopy(props.recipientName, props.stage);
    const result = await client.emails.send({
      from: fromAddress(),
      to: props.to,
      subject: copy.subject,
      html: buildUnlockReminderHtml(props),
      text: buildUnlockReminderText(props),
      tags: [
        { name: "category", value: "unlock_reminder" },
        { name: "stage", value: String(props.stage) },
      ],
    });
    if (result.error) {
      console.error("[resend] unlock-reminder send returned error", result.error);
      return;
    }
    console.log(
      `[resend] unlock-reminder stage=${props.stage} sent ${result.data?.id ?? "?"} to ${props.to}`,
    );
  } catch (err) {
    console.error("[resend] unlock-reminder send failed", err);
  }
}

// ── Annual birthday-reminder email ──────────────────────────────────────────
// Sent by the daily birthday-reminders cron ~7 days before a past recipient's
// next birthday, to a buyer who opted in (year_reminder) and gave a date. Warm
// nudge to make this year's song (repeat purchase). Best-effort: any failure is
// caught and logged, never thrown.

export type BirthdayReminderEmailProps = {
  to: string;
  recipientName: string;
};

function birthdayGenerateUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://singmybirthday.com";
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/generate`;
}

function buildBirthdayReminderHtml(props: BirthdayReminderEmailProps): string {
  const name = escapeHtml(props.recipientName);
  const generateUrl = birthdayGenerateUrl();
  const preheader = `It's almost ${name}'s birthday — make this year's song in a minute 🎂`;
  const preheaderPad = "&#847; &zwnj; &nbsp; &#8199; &#65279; ".repeat(20);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>🎂 ${name}'s birthday is coming up!</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;font-size:1px;color:#f5f3ff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${preheader} ${preheaderPad}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f3ff" style="background-color:#f5f3ff;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">

            <!-- Header: brand gradient + logo + wordmark -->
            <tr>
              <td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};padding:28px 32px;text-align:center;">
                <img src="${LOGO_MARK_WHITE_URL}" alt="" width="64" height="64" style="display:inline-block;border:0;outline:none;height:64px;width:64px;vertical-align:middle;" />
                <span style="display:inline-block;margin-left:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:0.2px;color:#ffffff;vertical-align:middle;line-height:64px;">
                  Sing My Birthday
                </span>
              </td>
            </tr>

            <!-- Headline -->
            <tr>
              <td align="center" style="padding:30px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:25px;line-height:1.25;font-weight:800;color:#0f172a;">
                🎂 ${name}'s birthday is coming up!
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td align="center" style="padding:14px 36px 0 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#4b5563;">
                It's almost ${name}'s birthday — make them this year's song in a minute. A fresh, personalized track to send their way and make their day.
              </td>
            </tr>

            <!-- Primary CTA -->
            <tr>
              <td align="center" style="padding:28px 32px 10px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="${BRAND_PURPLE}" style="background-color:${BRAND_PURPLE};background-image:${BRAND_GRADIENT};border-radius:14px;">
                      <a href="${generateUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 38px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px;line-height:1;">
                        Make ${name}'s song →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Copyable link -->
            <tr>
              <td align="center" style="padding:8px 32px 28px 32px;">
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#9ca3af;word-break:break-all;">
                  Or copy: <a href="${generateUrl}" style="color:#6b7280;">${generateUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:24px 32px 28px 32px;border-top:1px solid #f3f4f6;">
                <img src="${LOGO_LOCKUP_URL}" alt="" width="150" height="116" style="display:block;margin:0 auto 12px auto;border:0;outline:none;opacity:0.9;" />
                <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#4b5563;">
                  Made with love by Sing My Birthday
                </p>
                <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#6b7280;">
                  Sing My Birthday <span style="color:#d1d5db;">·</span> A glomotec Labs product
                </p>
                <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af;">
                  Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801
                </p>
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#9ca3af;">
                  <a href="${UNSUBSCRIBE_MAILTO}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildBirthdayReminderText(props: BirthdayReminderEmailProps): string {
  const name = props.recipientName;
  const generateUrl = birthdayGenerateUrl();
  return [
    "Sing My Birthday",
    "",
    `🎂 ${name}'s birthday is coming up!`,
    "",
    `It's almost ${name}'s birthday — make them this year's song in a minute.`,
    "",
    `Make ${name}'s song: ${generateUrl}`,
    "",
    "---",
    "Made with love by Sing My Birthday",
    "Sing My Birthday · A glomotec Labs product",
    "Sent by GLOBAL MOBILITY TECHNOLOGIES LLC, 1309 Coffeen Avenue STE 15705, Sheridan, WY 82801",
    `Unsubscribe: ${UNSUBSCRIBE_MAILTO}`,
  ].join("\n");
}

export async function sendBirthdayReminderEmail(props: BirthdayReminderEmailProps): Promise<void> {
  try {
    const client = getResend();
    if (!client) {
      console.warn("[resend] RESEND_API_KEY not set; birthday-reminder not sent");
      return;
    }
    const result = await client.emails.send({
      from: fromAddress(),
      to: props.to,
      subject: `🎂 ${props.recipientName}'s birthday is coming up!`,
      html: buildBirthdayReminderHtml(props),
      text: buildBirthdayReminderText(props),
      tags: [{ name: "category", value: "birthday_reminder" }],
    });
    if (result.error) {
      console.error("[resend] birthday-reminder send returned error", result.error);
      return;
    }
    console.log(`[resend] birthday-reminder sent ${result.data?.id ?? "?"} to ${props.to}`);
  } catch (err) {
    console.error("[resend] birthday-reminder send failed", err);
  }
}

// ── Original song-ready email (unchanged below) ─────────────────────────────

export async function sendSongReadyEmail(props: SongReadyEmailProps): Promise<void> {
  const client = getResend();
  if (!client) {
    console.warn("[resend] RESEND_API_KEY not set; skipping email send");
    return;
  }

  const payload: ResendSendPayload = {
    from: fromAddress(),
    to: props.to,
    subject: buildSubject(props),
    html: buildHtml(props),
    text: buildText(props),
    tags: [{ name: "category", value: "song_ready" }],
  };

  let lastReason = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const outcome = await trySendOnce(client, payload);
    if (outcome.ok) {
      console.log(
        `[resend] sent ${outcome.id} to ${payload.to}${attempt > 1 ? ` (attempt ${attempt})` : ""}`,
      );
      return;
    }
    lastReason = outcome.reason;
    if (!outcome.retryable) {
      console.error(
        `[resend] non-retryable failure on attempt ${attempt}: ${outcome.reason}`,
        failureContext(props),
      );
      return;
    }
    if (attempt < 3) {
      const wait = delayMsForAttempt(attempt);
      console.warn(`[resend] attempt ${attempt} failed (${outcome.reason}); retrying in ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  console.error(
    `[resend] all 3 attempts failed; last reason: ${lastReason}`,
    failureContext(props),
  );
}
