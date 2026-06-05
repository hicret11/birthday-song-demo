// Operational alerts to founders@ — separate from the user-facing Resend
// flow so an alert can fire even when the same code path that triggered the
// problem is failing. Best-effort: never throws, never blocks the caller.

import { Resend } from "resend";

const ALERT_TO = "founders@singmybirthday.com";

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
  return env && env.length > 0 ? env : "Sing My Birthday <onboarding@resend.dev>";
}

export async function alertSpendCapExceeded(
  service: string,
  spentCents: number,
  capCents: number,
): Promise<void> {
  try {
    const client = getResend();
    if (!client) {
      console.warn("[ops-alert] RESEND_API_KEY not set; cap-alert not sent");
      return;
    }
    const spent = (spentCents / 100).toFixed(2);
    const cap = (capCents / 100).toFixed(2);
    const subject = `⚠️ Daily spend cap hit: ${service} ($${spent} / $${cap})`;
    const body = [
      `${service} crossed its daily cap.`,
      ``,
      `Spent today: $${spent}`,
      `Cap:         $${cap}`,
      ``,
      `The relevant API route is now returning 503 to users until UTC midnight.`,
      `If this is expected (legitimate traffic spike), raise the cap in lib/spend-cap.ts.`,
      `If unexpected, check Vercel logs for the offending traffic pattern.`,
    ].join("\n");
    await client.emails.send({
      from: fromAddress(),
      to: ALERT_TO,
      subject,
      text: body,
      tags: [{ name: "category", value: "ops_alert" }],
    });
  } catch (err) {
    console.error("[ops-alert] send failed", err);
  }
}
