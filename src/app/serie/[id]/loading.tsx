import { Skeleton } from "@/components/ui/skeleton";

export default function ShowDetailLoading() {
  return (
    <div>
      <section className="relative w-full overflow-hidden">
        <Skeleton className="h-[50vh] w-full rounded-none md:h-[65vh]" />
        <div className="relative mx-auto -mt-32 flex max-w-6xl flex-col gap-6 px-4 pb-8 md:-mt-48 md:flex-row md:items-end md:px-6 lg:px-8">
          <Skeleton className="hidden aspect-[2/3] w-48 flex-shrink-0 rounded-lg md:block lg:w-56" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-72 sm:h-12 sm:w-96" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-20 w-full max-w-2xl" />
          </div>
        </div>
      </section>
      <section className="px-4 py-8 md:px-6 lg:px-8">
        <Skeleton className="mb-6 h-8 w-36" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
