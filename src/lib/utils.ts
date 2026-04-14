import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Ranking for quality tiers / resolution strings — lower index = better.
 * Maps both tier names (UHD, FHD, HD, SD) and raw resolutions (2160p, 1080p …).
 * Input is lowercased before lookup so "UHD", "uhd" and "Uhd" all map to the same rank. */
const QUALITY_RANK: Record<string, number> = {
  uhd: 0, "2160p": 0,
  fhd: 1, "1080p": 1,
  hd: 2, "720p": 2,
  sd: 3, "576p": 3, "480p": 3,
};

export function qualityRank(tier: string | null | undefined): number {
  if (!tier) return 99;
  return QUALITY_RANK[tier.trim().toLowerCase()] ?? 98;
}
