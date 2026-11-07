import type { Show } from "@/lib/tmdb";
import { ShowCard } from "@/components/show/show-card";

interface ShowGridProps {
  shows: Show[];
  heading?: string;
}

export function ShowGrid({ shows, heading = "Trending Serien" }: ShowGridProps) {
  if (shows.length === 0) return null;

  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        {heading}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>
    </section>
  );
}
