"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ShareTemplate, SharedSong } from "@/lib/api-types";
import { toAudioProxyUrl } from "@/lib/audio-proxy";
import { logClientEvent } from "@/lib/client-events";
import { greetingFor } from "@/lib/greetings";
import UnlockableAudio from "@/components/share/UnlockableAudio";
import { SharePremiere } from "@/components/share/SharePremiere";

const MAX_RETRIES = 2;

const OVERLAY_STYLES: Record<ShareTemplate, React.CSSProperties> = {
  classic: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "#fce7f3",
    textShadow:
      "0 0 12px rgba(236,72,153,0.55), 2px 0 0 #1a0b2e, -2px 0 0 #1a0b2e, 0 2px 0 #1a0b2e, 0 -2px 0 #1a0b2e",
  },
  elegant: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "#f5e070",
    textShadow: "2px 3px 0 #000000, 0 0 8px rgba(0,0,0,0.6)",
  },
  neon: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: "#ff66ff",
    textShadow:
      "0 0 10px #ff00ff, 0 0 20px #ff00ff, 2px 0 0 #3a0a3a, -2px 0 0 #3a0a3a, 0 2px 0 #3a0a3a, 0 -2px 0 #3a0a3a",
  },
  playful: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: "#ffffff",
    textShadow: "3px 3px 0 #000000, 0 0 12px rgba(0,0,0,0.4)",
  },
  corporate: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    color: "#ffffff",
    textShadow: "2px 0 0 #0b1220, -2px 0 0 #0b1220, 0 2px 0 #0b1220, 0 -2px 0 #0b1220, 0 0 10px rgba(0,0,0,0.5)",
  },
};

export function SharedSongBody({ song, className }: { song: SharedSong; className?: string }) {
  const overlayStyle = OVERLAY_STYLES[song.template] ?? OVERLAY_STYLES.classic;

  // Unlocked playback = the full-length song (persisted to R2 so it doesn't
  // expire), falling back to the raw Suno track. The highlight cut is only used
  // for the 24s preview + the video, not as the Standard deliverable.
  // NOTE: on a LOCKED song the server (toPublicSong) strips these URLs, so this
  // is "" and the player uses the gated preview route instead (see below).
  const [currentAudio, setCurrentAudio] = useState<string>(
    song.fullAudioUrl ?? song.audioUrl ?? "",
  );
  // Prefer the premium Remotion video when the render worker has produced one;
  // otherwise fall back to the ffmpeg-rendered videoUrl so nothing breaks before
  // the worker is configured.
  const [currentVideo, setCurrentVideo] = useState<string | undefined>(
    song.premiumVideoUrl ?? song.videoUrl,
  );
  const [retriesUsed, setRetriesUsed] = useState<number>(song.retryCount ?? 0);
  const [regenStatus, setRegenStatus] = useState<"idle" | "loading" | "error">("idle");
  const [regenError, setRegenError] = useState<string | null>(null);
  const [retryStyleNotes, setRetryStyleNotes] = useState<string>(song.styleNotes ?? "");
  const [showStyleEditor, setShowStyleEditor] = useState<boolean>(false);

  // Deluxe photo slideshow: rendered on-demand from the unlocked share view.
  // `slideshowUrl` is seeded from the persisted URL so a return visit shows it
  // straight away; a fresh render updates it in place (no manual refresh).
  const [slideshowUrl, setSlideshowUrl] = useState<string | undefined>(song.slideshowVideoUrl);
  const [slideshowStatus, setSlideshowStatus] = useState<"idle" | "rendering" | "error" | "unavailable">("idle");
  const slideshowTriggeredRef = useRef(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fire playback_started at most once per page view (ignores pause/seek/replay).
  const playbackLoggedRef = useRef(false);

  // Shared context for durable events on this share page.
  const eventCtx = {
    share_id: song.id,
    venue_slug: song.venueSlug ?? null,
    recipient_name: song.name,
    language: song.language,
    genre: song.genre,
  };

  function handlePlay(): void {
    if (playbackLoggedRef.current) return;
    playbackLoggedRef.current = true;
    logClientEvent("playback_started", eventCtx);
  }

  function flashToast(message: string): void {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2_500);
  }

  async function openShareSheet(): Promise<void> {
    if (typeof window === "undefined") return;
    // Share a CLEAN recipient link: the canonical /share/[id] tagged with
    // ?src=shared (so word-of-mouth opens are attributable), NOT the buyer's
    // current URL — that could carry session_id / unlocked / a preview token
    // that must never leak to the recipient.
    const url = `${window.location.origin}/share/${song.id}?src=shared`;
    logClientEvent("share_click", eventCtx);
    const text = `Listen to this birthday song for ${song.name}`;
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title: `Happy Birthday, ${song.name}!`, text, url });
        return;
      } catch {
        // user dismissed / share failed — fall through to clipboard copy.
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      flashToast("Link copied!");
    } catch {
      flashToast("Couldn't copy — long-press the URL bar to copy.");
    }
  }

  async function regenerate(): Promise<void> {
    if (retriesUsed >= MAX_RETRIES || regenStatus === "loading") return;
    setRegenStatus("loading");
    setRegenError(null);
    try {
      // If the user opened the style editor and changed the value, send the
      // override. An empty string is a meaningful "drop style notes" signal —
      // server treats `style_notes: ""` as "use plain genre this time".
      const originalNotes = song.styleNotes ?? "";
      const trimmedRetryNotes = retryStyleNotes.trim();
      const sendOverride = showStyleEditor && trimmedRetryNotes !== originalNotes.trim();
      const res = await fetch(`/api/share/${song.id}/regenerate`, {
        method: "POST",
        ...(sendOverride
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ style_notes: trimmedRetryNotes }),
            }
          : {}),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const msg =
          (data as { error?: { message?: string } }).error?.message ??
          "Couldn't make a new version. Please try again.";
        setRegenError(msg);
        setRegenStatus("error");
        return;
      }
      if (typeof (data as { audioUrl?: string }).audioUrl === "string") {
        setCurrentAudio((data as { audioUrl: string }).audioUrl);
      }
      if (typeof (data as { videoUrl?: string }).videoUrl === "string") {
        setCurrentVideo((data as { videoUrl: string }).videoUrl);
      }
      if (typeof (data as { retriesUsed?: number }).retriesUsed === "number") {
        setRetriesUsed((data as { retriesUsed: number }).retriesUsed);
      }
      setRegenStatus("idle");
      flashToast("Fresh take ready");
    } catch {
      setRegenError("Couldn't reach the server. Please try again.");
      setRegenStatus("error");
    }
  }

  const isRegenerating = regenStatus === "loading";
  const retriesRemaining = Math.max(0, MAX_RETRIES - retriesUsed);

  const nameSlug =
    song.name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song";
  const downloadExt = currentVideo ? "mp4" : "mp3";
  const unlocked = !!song.unlocked;

  // Auto-trigger the Deluxe photo slideshow render once the song is unlocked.
  // Nothing else calls /api/slideshow/render, so without this Deluxe buyers
  // never get their slideshow. One-shot (guarded by a ref) — the ffmpeg render
  // can take ~30–90s, so we don't impose any client-side timeout; the buyer
  // sees an in-progress state and the <video> appears when the URL comes back.
  useEffect(() => {
    if (slideshowTriggeredRef.current) return;
    if (!unlocked) return;
    if (song.plan !== "deluxe") return;
    if ((song.photoUrls?.length ?? 0) === 0) return;
    if (slideshowUrl) return; // already rendered (persisted or from a prior run)
    slideshowTriggeredRef.current = true;
    void (async () => {
      // setState lives in the async callback (not the effect body) so it reads as
      // "syncing from an external system" rather than a synchronous cascade. Runs
      // before the first await, so ordering is identical to the prior placement.
      setSlideshowStatus("rendering");
      try {
        const res = await fetch("/api/slideshow/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareId: song.id }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: unknown;
          error?: { code?: unknown };
        };
        if (res.ok && typeof data.url === "string") {
          setSlideshowUrl(data.url);
          setSlideshowStatus("idle");
        } else if (data.error?.code === "UNSUPPORTED") {
          // Permanent for this deploy — don't invite a retry that can't succeed.
          setSlideshowStatus("unavailable");
        } else {
          setSlideshowStatus("error");
        }
      } catch {
        setSlideshowStatus("error");
      }
    })();
  }, [unlocked, song.plan, song.photoUrls, song.id, slideshowUrl]);

  const showSlideshowArea =
    unlocked && song.plan === "deluxe" && (song.photoUrls?.length ?? 0) > 0;

  return (
    <div className={className}>
      <p className="text-center text-sm font-medium text-ink-soft">
        {song.language} • {song.genre} • {song.lyrics.title}
      </p>

      {/* Branded share video — only shown once the song is unlocked. The
          preview-gated audio below is the paywall surface for locked songs. */}
      {unlocked && currentVideo && (
        <div className="relative mt-6">
          <video
            key={currentVideo}
            controls
            playsInline
            onPlay={handlePlay}
            src={currentVideo}
            poster=""
            className="w-full rounded-2xl bg-noir shadow-lg"
          />
          <div
            className="pointer-events-none absolute bottom-10 left-0 right-0 px-6 text-center font-bold leading-tight"
            style={{ ...overlayStyle, fontSize: "clamp(1.25rem, 4.5vw, 2.5rem)" }}
          >
            {greetingFor(song.language, song.name)}
          </div>
        </div>
      )}

      {/* Audio: EVERY song is delivered as the theatrical Premiere reveal (not
          just crowd songs). The premiere is the player; UnlockableAudio still
          owns the paywall CTA (locked) / MP3 download (unlocked) with its own
          player hidden — same gate, one player. audioSrc is identical to the
          flat player's (locked → gated 24s preview clip), so the paywall behaves
          exactly as before. */}
      <SharePremiere
        recipientName={song.name}
        directorName={song.directorCredit || song.crowd?.directorName || song.senderName}
        songTitle={song.lyrics.title}
        audioSrc={
          unlocked ? toAudioProxyUrl(currentAudio) : `/api/share/${song.id}/preview`
        }
        language={song.language}
        directorNote={song.directorNote}
        isCrowd={song.crowd?.status === "merged"}
      />
      <UnlockableAudio
        shareId={song.id}
        audioSrc={
          unlocked ? toAudioProxyUrl(currentAudio) : `/api/share/${song.id}/preview`
        }
        unlocked={unlocked}
        recipientName={song.name}
        tier={song.tier}
        hidePlayer
      />

      {/* Unlocked-only downloads: branded video + photo slideshow. */}
      {unlocked && currentVideo && (
        <a
          href={`/api/share/${song.id}/download`}
          download={`birthday-song-${nameSlug}.${downloadExt}`}
          className="mt-3 block w-full rounded-2xl border border-sand bg-cream-soft px-5 py-3 text-center text-sm font-bold text-ink shadow-sm transition hover:bg-warm-soft"
        >
          <span aria-hidden>⬇</span> Download video
        </a>
      )}

      {showSlideshowArea && (
        <div className="mt-6">
          {slideshowUrl ? (
            <>
              <video
                key={slideshowUrl}
                controls
                playsInline
                src={slideshowUrl}
                className="w-full rounded-2xl bg-noir shadow-lg"
              />
              <a
                href={slideshowUrl}
                download
                className="mt-3 block w-full rounded-2xl border border-sand bg-cream-soft px-5 py-3 text-center text-sm font-bold text-ink shadow-sm transition hover:bg-warm-soft"
              >
                <span aria-hidden>⬇</span> Download slideshow
              </a>
            </>
          ) : slideshowStatus === "unavailable" ? (
            <p
              role="status"
              className="rounded-2xl border border-sand bg-cream-soft px-5 py-4 text-center text-sm text-ink-soft"
            >
              🎬 The photo slideshow isn&apos;t available right now — your song
              and video above are ready. Email info@singmybirthday.com and
              we&apos;ll get your slideshow sorted.
            </p>
          ) : slideshowStatus === "error" ? (
            <p
              role="status"
              className="rounded-2xl border border-sand bg-cream-soft px-5 py-4 text-center text-sm text-ink-soft"
            >
              Couldn&apos;t build the slideshow — refresh to retry.
            </p>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-2 rounded-2xl border border-sand bg-cream-soft px-5 py-6 text-center text-sm font-semibold text-ink shadow-sm"
            >
              <span className="text-lg">🎬 Creating your photo slideshow…</span>
              <span className="text-xs font-normal text-ink-soft">
                Stitching your photos to the song — this can take a minute.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action stack — Send (primary) / Try another (tertiary) */}
      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={openShareSheet}
          className="w-full rounded-full bg-jade px-5 py-4 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 hover:bg-jade-deep"
        >
          💌 Send it to them
        </button>

        {showStyleEditor && retriesUsed < MAX_RETRIES && (
          <input
            type="text"
            value={retryStyleNotes}
            onChange={(e) => setRetryStyleNotes(e.target.value.slice(0, 2000))}
            placeholder="Tweak the style for the next take…"
            maxLength={2000}
            disabled={isRegenerating}
            className="block w-full rounded-2xl border border-sand bg-cream-soft px-4 py-2 text-sm text-ink placeholder:text-ink-soft outline-none transition focus:ring-2 focus:ring-jade disabled:opacity-60"
          />
        )}

        <button
          type="button"
          onClick={regenerate}
          disabled={isRegenerating || retriesUsed >= MAX_RETRIES}
          className="block w-full rounded-full border border-sand bg-transparent px-5 py-2 text-center text-xs font-semibold text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRegenerating
            ? "Making a new version… (this takes about a minute)"
            : retriesUsed >= MAX_RETRIES
              ? "No more retries"
              : `↻ Try another version${retriesUsed > 0 ? ` (${retriesRemaining} left)` : ""}`}
        </button>

        {/* Sets expectations for the retry button — it re-rolls the audio, it
            does NOT let you edit the words (Suno's API can't change lyrics on
            an existing melody). */}
        <p className="text-center text-[11px] leading-relaxed text-ink-soft">
          This creates a new audio take with the same lyrics. To change the
          words, start a new song.
        </p>

        {retriesUsed < MAX_RETRIES && !isRegenerating && (
          <button
            type="button"
            onClick={() => setShowStyleEditor((v) => !v)}
            className="block w-full text-center text-[11px] text-ink-soft hover:text-ink"
          >
            {showStyleEditor ? "hide style editor" : "tweak style for next take"}
          </button>
        )}

        {regenError && (
          <p role="alert" className="text-center text-xs text-blush">
            {regenError}
          </p>
        )}
      </div>

      {(() => {
        const sender = song.senderName?.trim();
        const venue = song.venueName?.trim();
        const venueStyle = song.venueColor ? { color: song.venueColor } : undefined;
        if (sender && venue) {
          return (
            <p className="mt-6 text-center font-serif text-base italic text-ink-soft">
              Made with love from {sender} · at <span style={venueStyle}>{venue}</span>
            </p>
          );
        }
        if (venue) {
          return (
            <p className="mt-6 text-center font-serif text-base italic text-ink-soft">
              A song from <span style={venueStyle}>{venue}</span>
            </p>
          );
        }
        if (sender) {
          return (
            <p className="mt-6 text-center font-serif text-base italic text-ink-soft">
              Made with love from {sender}
            </p>
          );
        }
        return null;
      })()}

      <div
        dir={song.language === "Arabic" ? "rtl" : "ltr"}
        style={
          song.language === "Hindi"
            ? { fontFamily: '"Noto Sans Devanagari", "Mangal", system-ui, sans-serif' }
            : undefined
        }
        className="mt-8 space-y-4"
      >
        {song.lyrics.sections.map((section, idx) => (
          <div key={idx}>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-jade">
              [{section.tag}]
            </div>
            {section.lines.map((line, lineIdx) => (
              <p key={lineIdx} className="text-sm leading-relaxed text-ink">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Re-conversion / post-purchase cross-sell — turns recipients into
          creators, and nudges buyers to make a second song. One tasteful CTA. */}
      <div className="mt-12">
        <a
          href="/generate"
          className="block w-full rounded-full border border-jade/50 bg-transparent px-5 py-3.5 text-center text-sm font-bold text-jade-deep transition hover:border-jade hover:bg-jade/5"
        >
          {unlocked ? "🎂 Make another birthday song →" : "🎂 Make your own birthday song →"}
        </a>
      </div>

      <footer className="mt-8 text-center text-xs text-ink-soft">
        <Link href="/" className="underline-offset-2 hover:underline">
          Made with love by Sing My Birthday
        </Link>
      </footer>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-sm font-semibold text-white shadow-2xl backdrop-blur"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
