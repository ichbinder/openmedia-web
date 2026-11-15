import type { Brand, TitleMeta } from "@/lib/backend";
import { cn } from "@/lib/utils";

const BRAND_CLASSES: Record<Brand, string> = {
  netflix: "bg-red-600 text-white",
  prime: "bg-sky-700 text-white",
  disney: "bg-blue-800 text-white",
  apple: "bg-neutral-900 text-white ring-1 ring-white/40",
  hbo: "bg-purple-700 text-white",
  paramount: "bg-blue-600 text-white",
  sky: "bg-cyan-700 text-white",
  cinema: "bg-cinema-gold text-cinema-gold-foreground",
  other: "bg-neutral-600 text-white",
};

export function OriginLabel({ meta, className }: { meta: TitleMeta | null; className?: string }) {
  if (!meta?.label) return null;
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide",
        BRAND_CLASSES[meta.brand ?? "other"],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
