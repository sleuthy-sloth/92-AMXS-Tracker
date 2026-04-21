import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FirestoreTime } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes a tail number to ignore capitalization, hyphens, and standard prefixes (like AF-). 
 * This helps match 'AF-12-1234' with '121234' or '12-1234'.
 */
export function normalizeTailNumber(tail: string): string {
  if (!tail) return '';
  return tail.replace(/^af[-_]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * Matches a search query against a tail number, flexibly.
 */
export function tailMatchesSearch(tail: string, query: string): boolean {
  if (!tail || !query) return false;
  return normalizeTailNumber(tail).includes(normalizeTailNumber(query)) || tail.toLowerCase().includes(query.toLowerCase());
}

/**
 * Safely convert a Firestore time field (Timestamp or unresolved serverTimestamp FieldValue)
 * to a JS Date. Returns epoch-0 for missing/unresolved sentinels so callers can
 * compare/format without crashing mid-write.
 */
export function tsToDate(t: FirestoreTime | undefined | null): Date {
  if (t && typeof (t as { toDate?: () => Date }).toDate === "function") {
    return (t as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

export function tsToMillis(t: FirestoreTime | undefined | null): number {
  if (t && typeof (t as { toMillis?: () => number }).toMillis === "function") {
    return (t as { toMillis: () => number }).toMillis();
  }
  return 0;
}
