import type { Video } from "@/lib/tmdb";

interface TrailerSectionProps {
  videos: Video[];
}

export function TrailerSection({ videos }: TrailerSectionProps) {
  const trailers = videos.filter(
    (v) => v.site === "YouTube" && v.type === "Trailer",
  );

  // Prefer official trailers, fall back to any YouTube trailer.
  const trailer =
    trailers.find((t) => t.official) ?? trailers[0] ?? null;

  if (!trailer) return null;

  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Trailer
      </h2>
      <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-lg">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${trailer.key}`}
          title={trailer.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>
    </section>
  );
}
