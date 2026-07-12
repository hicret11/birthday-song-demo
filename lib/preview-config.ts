// Single source of truth for the free-preview length, in seconds.
//
// Shared by the server-side highlight cut (lib/audio-cut renders a clip this
// long) AND the client-side playback clamps (UnlockableAudio and the generate-
// flow PremiereReveal both pause/snap playback at this mark). Keeping ONE
// constant prevents the drift that used to exist here — the server cut a 15s
// clip, the players clamped at 15s, and a comment claimed 20s. If these
// disagree, a longer server clip gets truncated by a shorter client clamp
// (cutting off the recipient's name), so they must move together.
//
// Pure + dependency-free so it is safe to import in both server and client
// bundles (unlike lib/audio-cut, which pulls in ffmpeg and is server-only).
export const PREVIEW_SECONDS = 24;
