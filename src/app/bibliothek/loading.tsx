import { Skeleton } from "@/components/ui/skeleton";

export default function BibliothekLoading() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="mb-2 h-9 w-56" />
      <Skeleton className="mb-6 h-5 w-40" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/40">
            <Skeleton className="aspect-[2/3] w-full rounded-t-lg" />
            <div className="p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
