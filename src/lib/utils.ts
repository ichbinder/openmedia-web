import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string to German locale format.
 * Returns "Unbekannt" for invalid or empty dates.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Unbekannt";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unbekannt";
    
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "Unbekannt";
  }
}
