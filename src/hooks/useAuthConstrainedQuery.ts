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
import { useAuth } from '../contexts/AuthContext';

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
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    constraints,
    resultLimit = 500,
    excludeDemo = true,
    allowLeadershipWide = true,
    enabled = true,
  } = opts;

  // Stable identity of the caller-supplied constraints (by reference).
  const extraConstraints = useMemo(() => constraints ?? [], [constraints]);

  useEffect(() => {
    if (!profile || !enabled) {
      setLoading(false);
      return;
    }
    if (isDemoMode) {
      setData([]);
      setLoading(false);
      return;
    }

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

    setLoading(true);
    setError(null);
    const q = query(collection(db, collectionName), ...assembled);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      (err) => {
        console.error(`useAuthConstrainedQuery(${collectionName}):`, err);
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [
    collectionName,
    profile?.uid,
    profile?.shopId,
    profile?.amuId,
    profile?.role,
    isDemoMode,
    enabled,
    excludeDemo,
    allowLeadershipWide,
    resultLimit,
    extraConstraints,
  ]);

  return { data, loading, error };
}
