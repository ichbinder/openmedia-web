import { Skeleton } from "@/components/ui/skeleton";

export default function SerienLoading() {
  return (
    <>
      <section className="relative h-[60vh] w-full overflow-hidden md:h-[70vh]">
        <Skeleton className="absolute inset-0 rounded-none" />
      </section>
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
    </>
  );
}
