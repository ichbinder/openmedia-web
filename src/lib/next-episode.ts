export interface EpisodeCode {
  season: number;
  episode: number;
}

const isAfter = (a: EpisodeCode, b: EpisodeCode) =>
  a.season !== b.season ? a.season > b.season : a.episode > b.episode;

export function nextEpisode(
  had: EpisodeCode[],
  seasons: { season_number: number; episode_count: number }[],
  lastAired: EpisodeCode | null,
): EpisodeCode | null {
  if (!lastAired) return null;

  const regular = seasons
    .filter((s) => s.season_number >= 1 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const latest = had
    .filter((h) => h.season >= 1)
    .reduce<EpisodeCode | null>((max, h) => (!max || isAfter(h, max) ? h : max), null);

  let candidate: EpisodeCode | null = null;
  if (!latest) {
    if (regular[0]) candidate = { season: regular[0].season_number, episode: 1 };
  } else {
    const current = regular.find((s) => s.season_number === latest.season);
    if (current && latest.episode < current.episode_count) {
      candidate = { season: latest.season, episode: latest.episode + 1 };
    } else {
      const next = regular.find((s) => s.season_number > latest.season);
      if (next) candidate = { season: next.season_number, episode: 1 };
    }
  }

  return candidate && !isAfter(candidate, lastAired) ? candidate : null;
}
