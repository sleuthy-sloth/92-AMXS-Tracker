import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface AICacheEntry<T> {
  data: T;
  timestamp: Timestamp;
  hash: string; // Hash of the input data to detect changes
}

// ─── Read / Write ────────────────────────────────────────────────────

/**
 * Get a cached AI result from Firestore.
 * Returns null if no cache exists or if it's expired relative to the provided maxAgeMs.
 */
export async function getCachedAIResult<T>(
  collectionName: string,
  cacheKey: string,
  maxAgeMs: number = 3600000 // 1 hour default
): Promise<T | null> {
  try {
    const cacheRef = doc(db, 'ai_cache', `${collectionName}_${cacheKey}`);
    const snap = await getDoc(cacheRef);

    if (!snap.exists()) return null;

    const entry = snap.data() as AICacheEntry<T>;
    const age = Date.now() - (entry.timestamp?.toMillis?.() || 0);

    if (age > maxAgeMs) return null;

    return entry.data;
  } catch (err) {
    console.error('[AI Cache] Read error:', err);
    return null;
  }
}

/**
 * Get a cached AI result but return it even if stale (stale-while-revalidate).
 * Returns `null` only when there is no cache entry at all.
 */
export async function getCachedAIResultStaleOk<T>(
  collectionName: string,
  cacheKey: string,
  maxAgeMs: number = 3600000
): Promise<{ data: T | null; age: number; exists: boolean }> {
  try {
    const cacheRef = doc(db, 'ai_cache', `${collectionName}_${cacheKey}`);
    const snap = await getDoc(cacheRef);

    if (!snap.exists()) return { data: null, age: Infinity, exists: false };

    const entry = snap.data() as AICacheEntry<T>;
    const age = Date.now() - (entry.timestamp?.toMillis?.() || 0);

    if (age > maxAgeMs) return { data: entry.data, age, exists: true };

    return { data: entry.data, age, exists: true };
  } catch (err) {
    console.error('[AI Cache] Read error:', err);
    return { data: null, age: Infinity, exists: false };
  }
}

/**
 * Save an AI result to Firestore.
 */
export async function setCachedAIResult<T>(
  collectionName: string,
  cacheKey: string,
  data: T,
  hash: string = ''
): Promise<void> {
  try {
    const cacheRef = doc(db, 'ai_cache', `${collectionName}_${cacheKey}`);
    await setDoc(cacheRef, {
      data,
      hash,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('[AI Cache] Write error:', err);
  }
}

// ─── Distributed Cache Lock ──────────────────────────────────────────
// Prevents multiple clients from refreshing the same cache entry simultaneously.
// Lock path: ai_cache_locks/{cacheKey}
// Lock TTL: 5 minutes (if a client crashes, the lock auto-expires)

const LOCK_COLLECTION = 'ai_cache_locks';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheLock {
  lockedAt: Timestamp;
  expiresAt: Timestamp;
  owner: string; // Client-generated UUID for this session
}

/**
 * Try to acquire a distributed lock for refreshing a cache entry.
 * Returns true if the lock was acquired (caller should refresh).
 * Returns false if another client holds a valid lock.
 */
export async function acquireCacheLock(cacheKey: string, sessionId: string): Promise<boolean> {
  try {
    const lockRef = doc(db, LOCK_COLLECTION, cacheKey);
    const existing = await getDoc(lockRef);

    if (existing.exists()) {
      const lock = existing.data() as CacheLock;
      const expiresMs = lock.expiresAt?.toMillis?.() || 0;

      // If lock hasn't expired, someone else is refreshing
      if (Date.now() < expiresMs) {
        return false;
      }

      // Lock expired — we can take over. Overwrite it.
    }

    // Acquire the lock
    const now = Date.now();
    await setDoc(lockRef, {
      lockedAt: serverTimestamp(),
      expiresAt: new Timestamp(Math.floor((now + LOCK_TTL_MS) / 1000), 0),
      owner: sessionId,
    });

    return true;
  } catch (err) {
    // Firestore write rules might reject us or there's a conflict
    console.warn('[AI Cache] Lock acquisition failed:', err);
    return false;
  }
}

/**
 * Release a distributed cache lock.
 */
export async function releaseCacheLock(cacheKey: string, sessionId: string): Promise<void> {
  try {
    const lockRef = doc(db, LOCK_COLLECTION, cacheKey);
    const existing = await getDoc(lockRef);

    // Only release if we own the lock
    if (existing.exists()) {
      const lock = existing.data() as CacheLock;
      if (lock.owner === sessionId) {
        await deleteDoc(lockRef);
      }
    }
  } catch (err) {
    console.warn('[AI Cache] Lock release failed:', err);
  }
}

/**
 * Generate a simple session ID for distributed lock ownership.
 */
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Simple hash function for arrays of strings to detect data changes.
 */
export function generateDataHash(inputs: string[]): string {
  if (inputs.length === 0) return 'empty';
  const joined = inputs.join('|');
  let hash = 0;
  for (let i = 0; i < joined.length; i++) {
    const char = joined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
}
