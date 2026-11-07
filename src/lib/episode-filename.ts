const EPISODE_PATTERN = /(^|[^a-z0-9])s\d{1,2}e\d{1,3}(?![0-9])/i;

export function isEpisodeFilename(filename: string | undefined | null): boolean {
  return !!filename && EPISODE_PATTERN.test(filename);
}
