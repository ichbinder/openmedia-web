import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="px-4 py-8 md:px-6 lg:px-8">
      {/* Heading — mirrors h1 "Suche" */}
      <Skeleton className="mb-6 h-9 w-32" />

      {/* Search input placeholder — mirrors max-w-xl input */}
      <div className="mb-8 max-w-xl">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* Movie grid skeleton — mirrors MovieGrid used for results */}
      <section>
        <Skeleton className="mb-6 h-8 w-56" />
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
    </div>
  );
}
