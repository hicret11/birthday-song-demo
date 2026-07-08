import { describe, it, expect } from "vitest";
import { toPublicSong } from "../lib/public-song";
import type { SharedSong } from "../lib/api-types";

function baseSong(overrides: Partial<SharedSong> = {}): SharedSong {
  return {
    id: "abc123",
    name: "Sofia",
    language: "English",
    genre: "🎤 Pop",
    lyrics: { title: "For Sofia", sections: [], raw: "la la la", style: "pop", language: "English" },
    audioUrl: "https://cdn.example.com/full.mp3",
    highlightAudioUrl: "https://cdn.example.com/highlight.mp3",
    fullAudioUrl: "https://cdn.example.com/original-full.mp3",
    previewAudioUrl: "https://cdn.example.com/preview.mp3",
    videoUrl: "https://cdn.example.com/video.mp4",
    premiumVideoUrl: "https://cdn.example.com/premium.mp4",
    slideshowVideoUrl: "https://cdn.example.com/slideshow.mp4",
    template: "classic",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("toPublicSong — paywall enforcement", () => {
  it("strips every full-media URL from a LOCKED song", () => {
    const pub = toPublicSong(baseSong({ unlocked: false }));
    expect(pub.audioUrl).toBe(""); // required field blanked
    expect(pub.highlightAudioUrl).toBeUndefined();
    expect(pub.fullAudioUrl).toBeUndefined();
    expect(pub.previewAudioUrl).toBeUndefined();
    expect(pub.videoUrl).toBeUndefined();
    expect(pub.premiumVideoUrl).toBeUndefined();
    expect(pub.slideshowVideoUrl).toBeUndefined();
  });

  it("preserves non-media fields on a locked song", () => {
    const pub = toPublicSong(baseSong({ unlocked: false }));
    expect(pub.name).toBe("Sofia");
    expect(pub.lyrics.raw).toBe("la la la");
    expect(pub.genre).toBe("🎤 Pop");
  });

  it("passes an UNLOCKED song through untouched", () => {
    const song = baseSong({ unlocked: true });
    const pub = toPublicSong(song);
    expect(pub.audioUrl).toBe(song.audioUrl);
    expect(pub.highlightAudioUrl).toBe(song.highlightAudioUrl);
    expect(pub.fullAudioUrl).toBe(song.fullAudioUrl);
    expect(pub.videoUrl).toBe(song.videoUrl);
    expect(pub.premiumVideoUrl).toBe(song.premiumVideoUrl);
  });

  it("does not mutate the original locked song object", () => {
    const song = baseSong({ unlocked: false });
    toPublicSong(song);
    expect(song.audioUrl).toBe("https://cdn.example.com/full.mp3");
    expect(song.highlightAudioUrl).toBe("https://cdn.example.com/highlight.mp3");
  });
});
