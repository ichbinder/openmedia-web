const EPISODE_PATTERN = /(?:^|[ ._-])S(\d{1,2})[ ._-]?E(\d{1,3})/i;

export function isEpisodeFilename(filename: string | undefined | null): boolean {
  return !!filename && EPISODE_PATTERN.test(filename);
}
