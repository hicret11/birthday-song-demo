import type { ShareTemplate, SharedSong } from "@/lib/api-types";
import { toAudioProxyUrl } from "@/lib/audio-proxy";
import { greetingFor } from "@/lib/greetings";

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

  return (
    <div className={className}>
      <p className="text-center text-sm opacity-70">
        {song.language} • {song.genre} • {song.lyrics.title}
      </p>

      {song.videoUrl ? (
        <div className="relative mt-6">
          <video
            controls
            autoPlay
            playsInline
            src={song.videoUrl}
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
          controls
          autoPlay
          loop={false}
          src={toAudioProxyUrl(song.audioUrl)}
          className="mt-6 w-full"
        />
      )}

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
    </div>
  );
}
