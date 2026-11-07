import { getSeasonDetails } from "@/lib/tmdb";
import type { EpisodeSummary, SeasonSummary } from "@/lib/tmdb";

export async function loadSeasons(
  showId: number,
  summaries: SeasonSummary[],
): Promise<{ summary: SeasonSummary; episodes: EpisodeSummary[] }[]> {
  return Promise.all(
    summaries.map(async (summary) => {
      try {
        const detail = await getSeasonDetails(showId, summary.season_number);
        return { summary, episodes: detail.episodes };
      } catch (error) {
        console.error(
          `[loadSeasons] season ${summary.season_number} of ${showId} failed:`,
          error,
        );
        return { summary, episodes: [] };
      }
    }),
  );
}
