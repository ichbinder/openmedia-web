import type { Metadata } from "next";
import Link from "next/link";
import { getGenres } from "@/lib/tmdb";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Genres — CineScope",
};

export default async function GenresPage() {
  let genres;
  try {
    genres = await getGenres();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <AlertTriangle className="size-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">
          Genres konnten nicht geladen werden
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Genres
      </h1>
      <div className="flex flex-wrap gap-3">
        {genres.map((genre) => (
          <Link
            key={genre.id}
            href={`/genres/${genre.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
            )}
          >
            {genre.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
