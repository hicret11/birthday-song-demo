import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getLead, listTemplates, listActivity, getSampleShareLink } from "@/lib/admin-outreach";
import { OUTREACH_STATUSES } from "@/lib/outreach/provider";
import { renderDraft, pickTemplateKey } from "@/lib/outreach/email";
import { Badge, Callout, inputCls, btnCls, linkBtnCls, fmtTs } from "../../_ui";
import { updateLeadDetailAction, saveDraftAction, markContactedAction } from "../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "blue" | "amber" | "green" | "red" | "purple"> = {
  new: "blue", shortlisted: "amber", contacted: "purple", replied: "green", partnered: "green", not_relevant: "neutral",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-neutral-800/70 py-1.5 last:border-0">
      <div className="w-32 shrink-0 text-neutral-500">{label}</div>
      <div className="min-w-0 break-words text-neutral-200">{children}</div>
    </div>
  );
}

export default async function OutreachLeadPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string; ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const back = <Link href="/admin/outreach" className="text-fuchsia-400 hover:underline">← all leads</Link>;

  const res = await getLead(id);
  if (!res.ok) {
    let msg = "";
    if ("missing" in res && res.missing) msg = res.message;
    else if ("notFound" in res && res.notFound) msg = "Lead not found.";
    else if ("error" in res) msg = res.error;
    return <div>{back}<div className="mt-3"><Callout tone="amber">{msg}</Callout></div></div>;
  }
  const lead = res.lead;
  const [templates, activity, sampleLink] = await Promise.all([listTemplates(), listActivity(id), getSampleShareLink()]);
  const selectedKey = sp.template || pickTemplateKey(lead.category, templates);
  const template = templates.find((t) => t.template_key === selectedKey) ?? templates[0] ?? null;
  const draft = template ? renderDraft(lead, template, { sampleLink }) : null;

  return (
    <div className="max-w-3xl">
      {back}
      <div className="mt-2 mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{lead.business_name}</h1>
        <Badge tone={STATUS_TONE[lead.outreach_status] ?? "neutral"}>{lead.outreach_status}</Badge>
      </div>
      {sp.ok && <div className="mb-3"><Callout tone="green">Saved ({sp.ok}).</Callout></div>}
      {sp.err && <div className="mb-3"><Callout tone="red">{sp.err}</Callout></div>}

      {/* Business info */}
      <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-xs">
        <Field label="category">{lead.category ?? "—"}</Field>
        <Field label="city / area">{[lead.city, lead.area].filter(Boolean).join(" · ") || "—"}</Field>
        <Field label="address">{lead.address ?? "—"}</Field>
        <Field label="rating">{lead.rating ?? "—"}{lead.review_count ? ` (${lead.review_count} reviews)` : ""}</Field>
        <Field label="relevance">{lead.relevance_score ?? "—"}</Field>
        <Field label="links">
          <span className="flex flex-wrap gap-2">
            {lead.website_url && <a href={lead.website_url} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Website</a>}
            {lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Maps</a>}
            {lead.phone && <a href={`tel:${lead.phone}`} className={linkBtnCls}>☎ {lead.phone}</a>}
            {!lead.website_url && !lead.google_maps_url && !lead.phone && <span className="text-neutral-600">—</span>}
          </span>
        </Field>
        <Field label="last seen">{fmtTs(lead.last_seen_at)}</Field>
      </div>

      {/* Status / owner / notes */}
      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Status &amp; notes</h2>
      <form action={updateLeadDetailAction.bind(null, lead.id)} className="mb-5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Status
          <select name="outreach_status" defaultValue={lead.outreach_status} className={inputCls}>
            {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Owner<input name="owner" defaultValue={lead.owner ?? ""} className={`${inputCls} w-28`} /></label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Notes<input name="notes" defaultValue={lead.notes ?? ""} className={`${inputCls} w-72`} /></label>
        <button type="submit" className={btnCls}>Save</button>
      </form>

      {/* Email draft */}
      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Outreach email <span className="font-normal text-neutral-500">(draft only — copy &amp; send yourself; no email is sent)</span></h2>
      {templates.length === 0 ? (
        <Callout tone="amber">No email templates found (the Phase C3a migration may not be applied in this environment yet).</Callout>
      ) : (
        <>
          <form method="GET" className="mb-2 flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-neutral-400">Template
              <select name="template" defaultValue={selectedKey ?? ""} className={inputCls}>
                {templates.map((t) => <option key={t.template_key} value={t.template_key}>{t.name}</option>)}
              </select>
            </label>
            <button type="submit" className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800">Preview</button>
            {sampleLink ? <span className="pb-1.5 text-xs text-neutral-500">sample link included ✓</span> : <span className="pb-1.5 text-xs text-neutral-600">no promo-approved sample link yet</span>}
          </form>
          {draft && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <label className="mb-1 block text-xs text-neutral-500">Subject</label>
              <input readOnly value={draft.subject} className="mb-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200" />
              <label className="mb-1 block text-xs text-neutral-500">Body (select all → copy)</label>
              <textarea readOnly rows={14} value={draft.body} className="w-full resize-y rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-[12px] leading-relaxed text-neutral-200" />
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <form action={saveDraftAction.bind(null, lead.id)}>
                  <input type="hidden" name="template_key" value={selectedKey ?? ""} />
                  <button type="submit" className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800">Log draft to history</button>
                </form>
                <form action={markContactedAction.bind(null, lead.id)} className="flex items-end gap-2">
                  <input type="hidden" name="template_key" value={selectedKey ?? ""} />
                  <label className="flex flex-col gap-1 text-xs text-neutral-400">note (optional)<input name="note" className={`${inputCls} w-48`} /></label>
                  <button type="submit" className={btnCls}>Mark contacted</button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* History */}
      <h2 className="mt-5 mb-2 text-sm font-semibold text-neutral-300">Outreach history</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full border-collapse text-xs">
          <thead><tr className="border-b border-neutral-800 text-left text-neutral-400"><th className="px-3 py-2">when</th><th className="px-3 py-2">action</th><th className="px-3 py-2">template</th><th className="px-3 py-2">note</th><th className="px-3 py-2">actor</th></tr></thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a.id} className="border-b border-neutral-900">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-400">{fmtTs(a.created_at)}</td>
                <td className="px-3 py-1.5"><Badge tone={a.action === "contacted" ? "purple" : a.action === "replied" ? "green" : "neutral"}>{a.action}</Badge></td>
                <td className="px-3 py-1.5 text-neutral-400">{a.template_key ?? "—"}</td>
                <td className="px-3 py-1.5 text-neutral-300">{a.note ?? "—"}</td>
                <td className="px-3 py-1.5 text-neutral-500">{a.actor ?? "—"}</td>
              </tr>
            ))}
            {activity.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-500">No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
