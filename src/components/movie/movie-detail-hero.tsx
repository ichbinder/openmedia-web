import Image from "next/image";
import { Star } from "lucide-react";
import type { MovieDetail } from "@/lib/tmdb";
import { getBackdropUrl, getPosterUrl } from "@/lib/tmdb";

interface MovieDetailHeroProps {
  movie: MovieDetail;
}

function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function MovieDetailHero({ movie }: MovieDetailHeroProps) {
  const backdropUrl = getBackdropUrl(movie.backdrop_path, "w1280");
  const posterUrl = getPosterUrl(movie.poster_path, "w500");
  const year = movie.release_date?.split("-")[0] ?? "";
  const runtime = formatRuntime(movie.runtime);
  const genres = movie.genres.map((g) => g.name).join(", ");

  return (
    <section className="relative w-full overflow-hidden">
      {/* Backdrop image or muted fallback */}
      {backdropUrl ? (
        <div className="relative h-[50vh] w-full md:h-[65vh]">
          <Image
            src={backdropUrl}
            alt={`Backdrop – ${movie.title}`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
      ) : (
        <div className="h-[30vh] w-full bg-muted md:h-[40vh]" />
      )}

      {/* Content overlay */}
      <div className="relative mx-auto -mt-32 flex max-w-6xl flex-col gap-6 px-4 pb-8 md:-mt-48 md:flex-row md:items-end md:px-6 lg:px-8">
        {/* Poster thumbnail */}
        {posterUrl && (
          <div className="relative hidden aspect-[2/3] w-48 flex-shrink-0 overflow-hidden rounded-lg shadow-xl md:block lg:w-56">
            <Image
              src={posterUrl}
              alt={movie.title}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 224px, 192px"
            />
          </div>
        )}

        {/* Text info */}
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {movie.title}
          </h1>

          {movie.tagline && (
            <p className="text-sm italic text-muted-foreground md:text-base">
              {movie.tagline}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-cinema-gold">
              <Star className="size-4 fill-cinema-gold" />
              {movie.vote_average.toFixed(1)}
            </span>
            {year && <span>{year}</span>}
            {runtime && <span>{runtime}</span>}
          </div>

          {genres && (
            <p className="text-sm text-muted-foreground">{genres}</p>
          )}

          {movie.overview && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {movie.overview}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
