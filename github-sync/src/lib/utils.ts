import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FirestoreTime } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
