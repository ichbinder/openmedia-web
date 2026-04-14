import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Ranking for quality tiers / resolution strings — lower index = better.
 * Maps both tier names (UHD, FHD, HD, SD) and raw resolutions (2160p, 1080p …). */
const QUALITY_RANK: Record<string, number> = {
  UHD: 0, "2160p": 0,
  FHD: 1, "1080p": 1,
  HD: 2, "720p": 2,
  SD: 3, "576p": 3, "480p": 3,
};

export function qualityRank(tier: string | null | undefined): number {
  if (!tier) return 99;
  return QUALITY_RANK[tier] ?? 98;
}
