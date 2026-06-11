"use client";

import { useRef, useState } from "react";
import type { ShareTemplate, SharedSong } from "@/lib/api-types";
import { toAudioProxyUrl } from "@/lib/audio-proxy";
import { logClientEvent } from "@/lib/client-events";
import { greetingFor } from "@/lib/greetings";

const MAX_RETRIES = 2;

const OVERLAY_STYLES: Record<ShareTemplate, React.CSSProperties> = {
  classic: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "#1f2937",
    textShadow:
      "3px 0 0 #faf7f2, -3px 0 0 #faf7f2, 0 3px 0 #faf7f2, 0 -3px 0 #faf7f2, 2px 2px 0 #faf7f2, -2px 2px 0 #faf7f2, 2px -2px 0 #faf7f2, -2px -2px 0 #faf7f2",
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
};

export function SharedSongBody({ song, className }: { song: SharedSong; className?: string }) {
  const overlayStyle = OVERLAY_STYLES[song.template] ?? OVERLAY_STYLES.classic;

  const [currentAudio, setCurrentAudio] = useState<string>(song.audioUrl);
  const [currentVideo, setCurrentVideo] = useState<string | undefined>(song.videoUrl);
  const [retriesUsed, setRetriesUsed] = useState<number>(song.retryCount ?? 0);
  const [regenStatus, setRegenStatus] = useState<"idle" | "loading" | "error">("idle");
  const [regenError, setRegenError] = useState<string | null>(null);
  const [retryStyleNotes, setRetryStyleNotes] = useState<string>(song.styleNotes ?? "");
  const [showStyleEditor, setShowStyleEditor] = useState<boolean>(false);

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
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
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

  return (
    <div className={className}>
      <p className="text-center text-sm opacity-70">
        {song.language} • {song.genre} • {song.lyrics.title}
      </p>

      {currentVideo ? (
        <div className="relative mt-6">
          <video
            key={currentVideo}
            controls
            autoPlay
            playsInline
            onPlay={handlePlay}
            src={currentVideo}
            poster=""
            className="w-full rounded-2xl bg-black shadow-lg"
          />
          <div
            className="pointer-events-none absolute bottom-10 left-0 right-0 px-6 text-center font-bold leading-tight"
            style={{ ...overlayStyle, fontSize: "clamp(1.25rem, 4.5vw, 2.5rem)" }}
          >
            {greetingFor(song.language, song.name)}
          </div>
        </div>
      ) : (
        <audio
          key={currentAudio}
          controls
          autoPlay
          loop={false}
          onPlay={handlePlay}
          src={toAudioProxyUrl(currentAudio)}
          className="mt-6 w-full"
        />
      )}

      {/* Action stack — Send (primary) / Download (secondary) / Try another (tertiary) */}
      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={openShareSheet}
          className="w-full rounded-2xl bg-brand px-5 py-4 text-base font-extrabold text-white shadow-2xl shadow-fuchsia-500/30 transition hover:-translate-y-1 hover:shadow-fuchsia-500/50"
        >
          📤 Send to a friend
        </button>

        <a
          href={`/api/share/${song.id}/download`}
          download={`birthday-song-${nameSlug}.${downloadExt}`}
          className="block w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center text-sm font-bold transition hover:bg-white/15"
        >
          <span aria-hidden>⬇</span> Download song
        </a>

        {showStyleEditor && retriesUsed < MAX_RETRIES && (
          <input
            type="text"
            value={retryStyleNotes}
            onChange={(e) => setRetryStyleNotes(e.target.value.slice(0, 200))}
            placeholder="Tweak the style for the next take…"
            maxLength={200}
            disabled={isRegenerating}
            className="block w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-purple-400 disabled:opacity-60"
          />
        )}

        <button
          type="button"
          onClick={regenerate}
          disabled={isRegenerating || retriesUsed >= MAX_RETRIES}
          className="block w-full rounded-2xl border border-white/15 bg-transparent px-5 py-2 text-center text-xs font-semibold opacity-80 transition hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
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
        <p className="text-center text-[11px] leading-relaxed opacity-50">
          This creates a new audio take with the same lyrics. To change the
          words, start a new song.
        </p>

        {retriesUsed < MAX_RETRIES && !isRegenerating && (
          <button
            type="button"
            onClick={() => setShowStyleEditor((v) => !v)}
            className="block w-full text-center text-[11px] opacity-60 hover:opacity-90"
          >
            {showStyleEditor ? "hide style editor" : "tweak style for next take"}
          </button>
        )}

        {regenError && (
          <p role="alert" className="text-center text-xs text-rose-300">
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
            <p className="mt-6 text-center text-sm italic opacity-80">
              Made with love from {sender} · at <span style={venueStyle}>{venue}</span>
            </p>
          );
        }
        if (venue) {
          return (
            <p className="mt-6 text-center text-sm italic opacity-80">
              A song from <span style={venueStyle}>{venue}</span>
            </p>
          );
        }
        if (sender) {
          return (
            <p className="mt-6 text-center text-sm italic opacity-80">
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
            <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-60">
              [{section.tag}]
            </div>
            {section.lines.map((line, lineIdx) => (
              <p key={lineIdx} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>

      <footer className="mt-12 text-center text-xs opacity-70">
        <a href="/" className="underline-offset-2 hover:underline">
          Made with Birthday Song Generator
        </a>
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
