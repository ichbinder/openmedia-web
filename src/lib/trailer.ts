import type { Video } from "./tmdb";

function rank(video: Video): number {
  const languageRank = video.iso_639_1 === "de" ? 0 : video.iso_639_1 === "en" ? 2 : 4;
  return languageRank + (video.official ? 0 : 1);
}

export function pickTrailer(videos: Video[]): Video | null {
  const trailers = videos.filter(
    (v) => v.site === "YouTube" && v.type === "Trailer",
  );
  return trailers.reduce<Video | null>(
    (best, v) => (best === null || rank(v) < rank(best) ? v : best),
    null,
  );
}
