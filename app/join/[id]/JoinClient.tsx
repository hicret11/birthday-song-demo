"use client";

// The contributor experience. Warm, light, one thing to do: add your bit.
// Fully localized off the gift's language: all copy comes from the
// `crowdContributor` dictionary block, resolved server-side in page.tsx and
// passed in as `t` (with `dir` for RTL languages like Arabic).
// Live updates via Supabase Realtime: PRESENCE powers "N people adding right
// now", and a BROADCAST "contribution" event prepends others' additions in ~1s.
// A slow 30s poll stays as a graceful fallback when Realtime isn't configured
// (missing public env). No media, no paywall — this is pure participation.

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { crowdChannelName, CROWD_CONTRIBUTION_EVENT } from "@/lib/crowd-realtime";
import type { Dict } from "@/lib/i18n";

type CrowdContributorDict = Dict["crowdContributor"];

type TextKind = "line" | "memory" | "wish";
// What the composer is set to. "photo" swaps the textarea for an image picker;
// "voice" is a disabled "coming soon" affordance (never becomes the active kind).
type Kind = TextKind | "photo";

type Contribution = {
  id: string;
  authorName: string | null;
  kind: string;
  content: string | null;
  contentUrl: string | null;
};

// Emojis are universal; labels/placeholders come from the dictionary.
const KIND_EMOJI: Record<TextKind, string> = {
  line: "🎵",
  memory: "💫",
  wish: "🎂",
};
const TEXT_KINDS: TextKind[] = ["line", "memory", "wish"];

const MAX_LEN = 280;
// Mirror /api/photos/upload's guardrails so we fail fast, before the round-trip.
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

/** Fill {placeholder} tokens in a dictionary string. */
function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export default function JoinClient({
  giftId,
  recipientName,
  t,
  dir,
  initialContributions,
}: {
  giftId: string;
  recipientName: string;
  t: CrowdContributorDict;
  dir: "ltr" | "rtl";
  initialContributions: Contribution[];
}) {
  const [kind, setKind] = useState<Kind>("line");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  // Photo composer state: the picked file + a local object-URL preview.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Newest-first: the server returns contributions oldest-first, so reverse the
  // seed and prepend live ones on top (broadcast + optimistic own submit).
  const [contributions, setContributions] = useState<Contribution[]>(
    () => [...initialContributions].reverse(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [livePeople, setLivePeople] = useState(0);
  const pollRef = useRef<number | null>(null);

  const name = recipientName?.trim() || t.fallbackName;

  // Prepend a contribution, de-duped by id (guards against the same item
  // arriving via both broadcast and the poll / own submit).
  const addContribution = useCallback((c: Contribution) => {
    if (!c?.id) return;
    setContributions((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
  }, []);

  // Full re-sync from the server (newest-first). Used by the fallback poll and
  // after own submit so a contributor always sees their addition even if
  // Realtime isn't configured.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/crowd/${giftId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { contributions?: Contribution[] };
      if (Array.isArray(data.contributions)) {
        setContributions([...data.contributions].reverse());
      }
    } catch {
      // ignore transient poll errors
    }
  }, [giftId]);

  // Low-frequency safety-net poll (30s). This is the ONLY update path when
  // Realtime is unconfigured, and a cheap backstop for missed broadcasts when
  // it is.
  useEffect(() => {
    pollRef.current = window.setInterval(refresh, 30000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Supabase Realtime: presence (live counter) + broadcast (new contributions).
  // Skipped entirely — leaving the poll as the fallback — when the public env
  // isn't configured (getSupabaseBrowser returns null).
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const presenceKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const channel = supabase.channel(crowdChannelName(giftId), {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on("broadcast", { event: CROWD_CONTRIBUTION_EVENT }, ({ payload }) => {
        addContribution(payload as Contribution);
      })
      .on("presence", { event: "sync" }, () => {
        setLivePeople(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ at: Date.now() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [giftId, addContribution]);

  // Free the object-URL preview whenever it's replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const clearPhoto = useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onPickPhoto = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setDone(false);
      setError(null);
      if (!file) {
        clearPhoto();
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError(t.errNotImage);
        clearPhoto();
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError(t.errTooBig);
        clearPhoto();
        return;
      }
      setPhotoFile(file);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [clearPhoto, t],
  );

  const submitText = useCallback(async () => {
    const body = content.trim();
    if (!body) {
      setError(t.errNeedText);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crowd/${giftId}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, content: body, authorName: authorName.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (res.ok && data.ok) {
        setContent("");
        setDone(true);
        await refresh();
      } else {
        setError(data.error?.message ?? t.errSend);
      }
    } catch {
      setError(t.errNetwork);
    } finally {
      setSubmitting(false);
    }
  }, [content, kind, authorName, giftId, refresh, t]);

  const submitPhoto = useCallback(async () => {
    if (!photoFile) {
      setError(t.errNeedPhoto);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1. Upload the image → get its public URL.
      const form = new FormData();
      form.append("photos", photoFile);
      const upRes = await fetch("/api/photos/upload", { method: "POST", body: form });
      const upData = (await upRes.json().catch(() => ({}))) as {
        urls?: string[];
        error?: { message?: string };
      };
      const url = upData.urls?.[0];
      if (!upRes.ok || !url) {
        setError(upData.error?.message ?? t.errUpload);
        return;
      }
      // 2. Attach it to the gift as a photo contribution.
      const res = await fetch(`/api/crowd/${giftId}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "photo",
          content_url: url,
          authorName: authorName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (res.ok && data.ok) {
        clearPhoto();
        setDone(true);
        await refresh();
      } else {
        setError(data.error?.message ?? t.errAddPhoto);
      }
    } catch {
      setError(t.errNetwork);
    } finally {
      setSubmitting(false);
    }
  }, [photoFile, authorName, giftId, refresh, clearPhoto, t]);

  const submit = kind === "photo" ? submitPhoto : submitText;

  const count = contributions.length;

  return (
    <main dir={dir} className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-[540px]">
        <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-pink">
          {t.overline}
        </p>
        <h1 className="mt-2 text-center font-display text-3xl font-black leading-tight">
          {t.headingPrefix}
          {name}
          {t.headingSuffix}
        </h1>
        <p className="mx-auto mt-3 max-w-[420px] text-center text-sm leading-relaxed text-ink-soft">
          {t.introLead}
          {name}
          {t.introAfterName}
          <b>{t.you}</b>
          {t.introTail}
        </p>

        {livePeople >= 2 && (
          <p className="mt-4 text-center text-sm font-bold text-jade">
            <span className="mr-1 inline-block animate-pulse">🟢</span>
            {livePeople} {t.liveAdding}
          </p>
        )}

        {count > 0 && (
          <p className="mt-2 text-center text-sm font-bold text-jade">
            {fill(count === 1 ? t.countOne : t.countMany, { n: count })}
          </p>
        )}

        {/* Composer */}
        <div className="mt-6 rounded-3xl border border-sand bg-cream-soft p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {TEXT_KINDS.map((k) => {
              const sel = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setDone(false);
                    setError(null);
                  }}
                  aria-pressed={sel}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    sel
                      ? "bg-gradient-to-r from-brand-amber to-brand-pink text-white"
                      : "border border-sand bg-cream text-ink hover:border-brand-pink"
                  }`}
                >
                  {KIND_EMOJI[k]} {t.kinds[k].label}
                </button>
              );
            })}

            {/* Photo — uploads an image instead of text. */}
            <button
              type="button"
              onClick={() => {
                setKind("photo");
                setDone(false);
                setError(null);
              }}
              aria-pressed={kind === "photo"}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                kind === "photo"
                  ? "bg-gradient-to-r from-brand-amber to-brand-pink text-white"
                  : "border border-sand bg-cream text-ink hover:border-brand-pink"
              }`}
            >
              📷 {t.photoTab}
            </button>

            {/* Voice — coming soon, disabled affordance. */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t.voiceTitle}
              className="cursor-not-allowed rounded-full border border-dashed border-sand bg-cream px-4 py-2 text-sm font-bold text-ink-soft/60"
            >
              🎤 {t.voiceTab}
            </button>
          </div>

          {kind === "photo" ? (
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={PHOTO_ACCEPT}
                onChange={onPickPhoto}
                className="hidden"
              />
              {photoPreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt={t.photoPreviewAlt}
                    className="max-h-72 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute right-2 top-2 rounded-full bg-ink/70 px-3 py-1 text-xs font-bold text-white backdrop-blur"
                  >
                    {t.photoChange}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-sand bg-cream px-4 py-8 text-center text-sm font-semibold text-ink-soft transition hover:border-brand-pink"
                >
                  <span className="text-2xl">📷</span>
                  {t.photoPickPrompt}
                  <span className="text-[11px] font-normal text-ink-soft/70">{t.photoHint}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value.slice(0, MAX_LEN));
                  setDone(false);
                }}
                rows={3}
                placeholder={t.kinds[kind].placeholder}
                className="mt-4 w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-base text-ink outline-none focus:border-brand-pink"
              />
              <div className="mt-1 text-right text-[11px] text-ink-soft">
                {content.length}/{MAX_LEN}
              </div>
            </>
          )}

          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value.slice(0, 60))}
            placeholder={t.namePlaceholder}
            className="mt-2 w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-sm text-ink outline-none focus:border-brand-pink"
          />

          {error && <p className="mt-3 text-sm font-semibold text-brand-pink">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-amber to-brand-pink px-6 py-4 text-base font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {submitting
              ? kind === "photo"
                ? t.uploading
                : t.sending
              : done
                ? t.addAnother
                : kind === "photo"
                  ? t.submitPhoto
                  : t.submitText}
          </button>

          {done && (
            <p className="mt-3 text-center text-sm font-semibold text-jade">
              {t.donePrefix}
              {name}
              {t.doneSuffix}
            </p>
          )}
        </div>

        {/* The circle so far */}
        {count > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-center text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
              {t.circlePrefix}
              {name}
              {t.circleSuffix}
            </p>
            <ul className="space-y-3">
              {contributions.map((c) =>
                c.kind === "photo" && c.contentUrl ? (
                  <li
                    key={c.id}
                    className="overflow-hidden rounded-2xl border border-sand bg-cream-soft text-sm text-ink"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.contentUrl}
                      alt={c.authorName ? fill(t.photoFromAlt, { name: c.authorName }) : t.photoAlt}
                      loading="lazy"
                      className="max-h-64 w-full object-cover"
                    />
                    <div className="px-4 py-2">
                      <span className="mr-1">📷</span>
                      {c.authorName ? (
                        <span className="text-xs font-semibold text-ink-soft">
                          — {c.authorName}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-soft">{t.photoCaption}</span>
                      )}
                    </div>
                  </li>
                ) : (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-sand bg-cream-soft px-4 py-3 text-sm text-ink"
                  >
                    <span className="mr-1">
                      {c.kind === "memory" ? "💫" : c.kind === "wish" ? "🎂" : "🎵"}
                    </span>
                    {c.content}
                    {c.authorName && (
                      <span className="mt-1 block text-xs font-semibold text-ink-soft">
                        — {c.authorName}
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-ink-soft/70">{t.footer}</p>
      </div>
    </main>
  );
}
