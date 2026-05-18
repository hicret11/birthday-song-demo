const SUNO_TEMPFILE_PATTERN = /tempfile\.aiquickdraw\.com\/r\/([a-f0-9]{32})\.mp3/i;

export function toAudioProxyUrl(url: string): string {
  const match = url.match(SUNO_TEMPFILE_PATTERN);
  return match ? `/api/audio/${match[1]}` : url;
}
