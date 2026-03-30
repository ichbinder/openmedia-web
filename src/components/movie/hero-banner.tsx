import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Movie } from "@/lib/tmdb";
import { getBackdropUrl } from "@/lib/tmdb";

interface HeroBannerProps {
  movie: Movie;
}

export function HeroBanner({ movie }: HeroBannerProps) {
  const backdropUrl = getBackdropUrl(movie.backdrop_path, "w1280");

  if (!backdropUrl) {
    return null;
  }

  const year = movie.release_date?.split("-")[0] ?? "";
  const overview =
    movie.overview.length > 150
      ? movie.overview.slice(0, 150).trimEnd() + "…"
      : movie.overview;

  return (
    <section className="relative h-[60vh] w-full overflow-hidden md:h-[70vh]">
      <Image
        src={backdropUrl}
        alt={movie.title}
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

      {/* Text overlay */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 md:p-10 lg:max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {movie.title}
        </h1>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1 text-cinema-gold">
            <Star className="size-4 fill-cinema-gold" />
            {movie.vote_average.toFixed(1)}
          </span>
          {year && <span>{year}</span>}
        </div>

        {overview && (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {overview}
          </p>
        )}

        <Link
          href={`/movie/${movie.id}`}
          className="mt-2 inline-flex w-fit items-center rounded-lg bg-cinema-gold px-5 py-2.5 text-sm font-semibold text-cinema-gold-foreground transition-colors hover:bg-cinema-gold/90"
        >
          Details ansehen
        </Link>
      </div>
    </section>
  );
}
