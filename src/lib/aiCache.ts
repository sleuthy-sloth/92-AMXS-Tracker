import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface AICacheEntry<T> {
  data: T;
  timestamp: Timestamp;
  hash: string; // Hash of the input data to detect changes
}

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
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error('[AI Cache] Write error:', err);
  }
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
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
}
