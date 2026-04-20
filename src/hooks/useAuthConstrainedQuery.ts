import { useEffect, useMemo, useState } from 'react';
import {
  QueryConstraint,
  collection,
  limit as fsLimit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContextInstance';

export interface ConstrainedQueryOptions {
  /** Extra constraints appended after the auth-scope filters. Memoize this! */
  constraints?: QueryConstraint[];
  /** Hard cap on number of docs returned (default 500). */
  resultLimit?: number;
  /** Automatically append `where('isDemo', '==', false)`. Default true. */
  excludeDemo?: boolean;
  /** If the caller is leadership, skip shop/AMU filters. Default true. */
  allowLeadershipWide?: boolean;
  /** When false, the query is skipped (useful before prerequisites load). */
  enabled?: boolean;
}

export interface ConstrainedQueryResult<T> {
  data: (T & { id: string })[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a Firestore collection with the caller's shop/AMU scope
 * automatically applied, a demo-exclusion filter, and a hard limit. This
 * replaces the 5+ copies of the same filter-building block across pages.
 *
 * NOTE: pass a stable `constraints` array (useMemo). A new array reference
 * each render will resubscribe on every render.
 */
export function useAuthConstrainedQuery<T>(
  collectionName: string,
  opts: ConstrainedQueryOptions = {}
): ConstrainedQueryResult<T> {
  const { profile, isDemoMode } = useAuth();
  const [firestoreData, setFirestoreData] = useState<(T & { id: string })[]>([]);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);

  const {
    constraints,
    resultLimit = 500,
    excludeDemo = true,
    allowLeadershipWide = true,
    enabled = true,
  } = opts;

  // Stable identity of the caller-supplied constraints (by reference).
  const extraConstraints = useMemo(() => constraints ?? [], [constraints]);

  // The subscription is only live when we have a profile, are not in demo
  // mode, and the caller has opted in. Outside of that window the hook
  // returns empty data, not-loading, no-error without touching state from
  // inside the effect.
  const active = !!profile && enabled && !isDemoMode;

  const data = useMemo<(T & { id: string })[]>(
    () => (active ? firestoreData : []),
    [active, firestoreData]
  );
  const loading = active ? firestoreLoading : false;
  const error = active ? firestoreError : null;

  useEffect(() => {
    if (!active || !profile) return;

    const assembled: QueryConstraint[] = [];
    if (excludeDemo) assembled.push(where('isDemo', '==', false));

    const wideLeadership = allowLeadershipWide && profile.role === 'leadership';
    if (!wideLeadership) {
      if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        assembled.push(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        assembled.push(where('shopId', '==', profile.shopId));
      }
    }

    for (const c of extraConstraints) assembled.push(c);
    assembled.push(fsLimit(resultLimit));

    // Note: we intentionally do not reset loading/error on re-subscription.
    // The next onSnapshot callback flips them correctly and any stale data
    // from the previous subscription stays visible during the brief gap.
    const q = query(collection(db, collectionName), ...assembled);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFirestoreData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setFirestoreLoading(false);
      },
      (err) => {
        console.error(`useAuthConstrainedQuery(${collectionName}):`, err);
        setFirestoreError(err);
        setFirestoreLoading(false);
      }
    );
    return unsub;
  }, [
    active,
    collectionName,
    profile,
    excludeDemo,
    allowLeadershipWide,
    resultLimit,
    extraConstraints,
  ]);

  return { data, loading, error };
}
