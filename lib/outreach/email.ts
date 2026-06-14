// Pure, deterministic outreach-email draft rendering. NO AI, NO sending, no IO.
// Fills {{placeholders}} from public business-level lead fields only.

export type EmailTemplate = {
  template_key: string;
  name: string;
  category_hint: string | null;
  subject: string;
  body: string;
};

export type DraftLead = {
  business_name: string | null;
  city: string | null;
  area: string | null;
  category: string | null;
};

const SITE = "https://singmybirthday.com";

export function renderDraft(
  lead: DraftLead,
  template: Pick<EmailTemplate, "subject" | "body">,
  opts: { sampleLink?: string | null } = {},
): { subject: string; body: string } {
  const sampleLine = opts.sampleLink ? `Here's a sample we made: ${opts.sampleLink}\n\n` : "";
  const vars: Record<string, string> = {
    business_name: (lead.business_name || "your team").trim(),
    city: (lead.city || "the UAE").trim(),
    area: (lead.area || lead.city || "the UAE").trim(),
    category: (lead.category || "venue").trim(),
    site: SITE,
    sample_line: sampleLine,
  };
  const fill = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (k in vars ? vars[k] : ""));
  return { subject: fill(template.subject), body: fill(template.body) };
}

/** Pick the best-matching template for a lead's category (falls back to the first). */
export function pickTemplateKey(category: string | null, templates: EmailTemplate[]): string | null {
  if (templates.length === 0) return null;
  const cat = (category || "").toLowerCase();
  for (const t of templates) {
    const hints = (t.category_hint || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    if (hints.some((h) => h && (cat.includes(h) || h.includes(cat) && cat.length > 2))) return t.template_key;
  }
  return templates[0].template_key;
}
