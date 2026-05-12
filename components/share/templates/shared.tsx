import type { SharedSong } from "@/lib/api-types";

export function SharedSongBody({ song, className }: { song: SharedSong; className?: string }) {
  return (
    <div className={className}>
      <p className="text-center text-sm opacity-70">
        {song.language} • {song.genre} • {song.lyrics.title}
      </p>

      <audio
        controls
        autoPlay
        loop={false}
        src={song.audioUrl}
        className="mt-6 w-full"
      />

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
