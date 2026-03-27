import { getTrendingMovies } from "@/lib/tmdb";
import { HeroBanner } from "@/components/movie/hero-banner";
import { MovieGrid } from "@/components/movie/movie-grid";
import { AlertTriangle } from "lucide-react";

export default async function Home() {
  let movies;
  try {
    movies = await getTrendingMovies();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <AlertTriangle className="size-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">
          Filme konnten nicht geladen werden
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  // Find the first movie with a valid backdrop for the hero
  const heroMovie = movies.find((m) => m.backdrop_path !== null);
  // Remaining movies for the grid (exclude hero movie to avoid duplication)
  const gridMovies = heroMovie
    ? movies.filter((m) => m.id !== heroMovie.id)
    : movies;

  return (
    <>
      {heroMovie && <HeroBanner movie={heroMovie} />}
      <MovieGrid movies={gridMovies} />
    </>
  );
}
