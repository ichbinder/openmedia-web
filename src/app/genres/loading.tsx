import { Skeleton } from "@/components/ui/skeleton";

export default function GenresLoading() {
  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      {/* Heading — mirrors h1 "Genres" */}
      <Skeleton className="mb-6 h-8 w-32" />

      {/* Genre chip skeletons — mirrors flex-wrap gap-3 of outline buttons */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 18 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-9 rounded-md"
            style={{ width: `${60 + (i % 5) * 20}px` }}
          />
        ))}
      </div>
    </section>
  );
}
