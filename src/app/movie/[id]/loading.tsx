import { Skeleton } from "@/components/ui/skeleton";

export default function MovieDetailLoading() {
  return (
    <main>
      {/* Hero backdrop skeleton — mirrors MovieDetailHero h-[50vh] md:h-[65vh] */}
      <section className="relative w-full overflow-hidden">
        <Skeleton className="h-[50vh] w-full rounded-none md:h-[65vh]" />

        {/* Content overlay — mirrors poster + text info area */}
        <div className="relative mx-auto -mt-32 flex max-w-6xl flex-col gap-6 px-4 pb-8 md:-mt-48 md:flex-row md:items-end md:px-6 lg:px-8">
          {/* Poster thumbnail skeleton */}
          <Skeleton className="hidden aspect-[2/3] w-48 flex-shrink-0 rounded-lg md:block lg:w-56" />

          {/* Text info skeleton */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-72 sm:h-12 sm:w-96" />
            <Skeleton className="h-4 w-48" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-20 w-full max-w-2xl" />
          </div>
        </div>
      </section>

      {/* Cast scroll strip skeleton — mirrors CastList layout */}
      <section className="px-4 py-8 md:px-6 lg:px-8">
        <Skeleton className="mb-6 h-8 w-36" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex w-28 flex-shrink-0 flex-col items-center gap-2"
            >
              <Skeleton className="size-24 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </section>

      {/* Trailer skeleton — mirrors TrailerSection aspect-video max-w-4xl */}
      <section className="px-4 py-8 md:px-6 lg:px-8">
        <Skeleton className="mb-6 h-8 w-28" />
        <Skeleton className="aspect-video w-full max-w-4xl rounded-lg" />
      </section>

      {/* Similar movies grid skeleton — mirrors MovieGrid */}
      <section className="px-4 py-8 md:px-6 lg:px-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-0 overflow-hidden">
              <Skeleton className="aspect-[2/3] w-full" />
              <div className="flex flex-col gap-1 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
