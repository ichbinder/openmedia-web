import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeasonDetails, getShowDetails } from "@/lib/tmdb";
import { MovieDetailHero } from "@/components/movie/movie-detail-hero";
import { CastList } from "@/components/movie/cast-list";
import { TrailerSection } from "@/components/movie/trailer-section";
import { SeasonList } from "@/components/show/season-list";
import { ShowGrid } from "@/components/show/show-grid";
import { AlertTriangle } from "lucide-react";

interface ShowPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ShowPageProps): Promise<Metadata> {
  const { id } = await params;
  const showId = Number(id);

  if (isNaN(showId)) {
    return { title: "Serie nicht gefunden — CineScope" };
  }

  try {
    const show = await getShowDetails(showId);
    return {
      title: `${show.name} — CineScope`,
      description: show.overview || undefined,
    };
  } catch {
    return { title: "Serie nicht gefunden — CineScope" };
  }
}

export default async function ShowDetailPage({ params }: ShowPageProps) {
  const { id } = await params;
  const showId = Number(id);

  if (isNaN(showId)) {
    notFound();
  }

  let show;
  let seasons;
  try {
    show = await getShowDetails(showId);
    seasons = await Promise.all(
      show.seasons.map(async (summary) => ({
        summary,
        episodes: (await getSeasonDetails(showId, summary.season_number))
          .episodes,
      })),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <AlertTriangle className="size-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">
          Serie konnte nicht geladen werden
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div>
      <MovieDetailHero
        movie={{
          title: show.name,
          backdrop_path: show.backdrop_path,
          poster_path: show.poster_path,
          release_date: show.first_air_date,
          runtime: null,
          genres: show.genres,
          tagline: show.tagline,
          vote_average: show.vote_average,
          overview: show.overview,
        }}
      />
      <SeasonList showId={showId} seasons={seasons} />
      <CastList cast={show.credits.cast} />
      <TrailerSection videos={show.videos.results} />
      <ShowGrid shows={show.similar.results} heading="Ähnliche Serien" />
    </div>
  );
}
