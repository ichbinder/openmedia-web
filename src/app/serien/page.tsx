import { getTrendingShows } from "@/lib/tmdb";
import type { Movie } from "@/lib/tmdb";
import { HeroBanner } from "@/components/movie/hero-banner";
import { ShowGrid } from "@/components/show/show-grid";
import { AlertTriangle } from "lucide-react";

export default async function SerienPage() {
  let shows;
  try {
    shows = await getTrendingShows();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <AlertTriangle className="size-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">
          Serien konnten nicht geladen werden
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  const heroShow = shows.find((s) => s.backdrop_path !== null);
  const gridShows = heroShow ? shows.filter((s) => s.id !== heroShow.id) : shows;
  const heroMovie = heroShow && {
    id: heroShow.id,
    title: heroShow.name,
    overview: heroShow.overview,
    backdrop_path: heroShow.backdrop_path,
    vote_average: heroShow.vote_average,
    release_date: heroShow.first_air_date,
  } as Movie;

  return (
    <>
      {heroMovie && (
        <HeroBanner movie={heroMovie} href={`/serie/${heroMovie.id}`} />
      )}
      <ShowGrid shows={gridShows} />
    </>
  );
}
