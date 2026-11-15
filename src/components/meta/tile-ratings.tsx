import type { TitleMeta } from "@/lib/backend";

export function TileRatings({ meta }: { meta: TitleMeta | null }) {
  const { critics, audience } = meta?.ratings ?? {};
  const parts = [
    critics !== undefined && { text: `🍅 ${critics}%`, spoken: `Kritiker ${critics} Prozent` },
    audience !== undefined && { text: `🍿 ${audience}%`, spoken: `Zuschauer ${audience} Prozent` },
  ].filter((p) => p !== false);
  if (parts.length === 0) return null;
  return (
    <span aria-label={parts.map((p) => p.spoken).join(", ")}>
      {parts.map((p) => p.text).join(" · ")}
    </span>
  );
}
