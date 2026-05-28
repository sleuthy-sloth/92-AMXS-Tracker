import { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  QueryConstraint,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceLog, DIFMLog, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { useDemoData } from '../contexts/DemoDataProvider';

export interface UseMaintenanceLogsReturn {
  logs: MaintenanceLog[];
  difm: DIFMLog[];
  personnelRoster: UserProfile[];
  snapshotError: string | null;
  hasMoreLogs: boolean;
  hasMoreDifm: boolean;
  loadingRef: React.RefObject<HTMLDivElement | null>;
  difmLoadingRef: React.RefObject<HTMLDivElement | null>;
  isArchiveView: boolean;
  setIsArchiveView: (value: boolean) => void;
  demoSeededLogs: MaintenanceLog[];
  setDemoSeededLogs: React.Dispatch<React.SetStateAction<MaintenanceLog[]>>;
  demoArchiveOverrides: Record<string, boolean>;
  setDemoArchiveOverrides: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function useMaintenanceLogs(): UseMaintenanceLogsReturn {
  const { profile, isDemoMode } = useAuth();
  const { logs: demoLogs, difm: demoDifm, personnel: demoPersonnel } = useDemoData();
  const [firestoreLogs, setFirestoreLogs] = useState<MaintenanceLog[]>([]);
  const [firestoreDifm, setFirestoreDifm] = useState<DIFMLog[]>([]);
  const [firestorePersonnelRoster, setFirestorePersonnelRoster] = useState<UserProfile[]>([]);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [demoSeededLogs, setDemoSeededLogs] = useState<MaintenanceLog[]>([]);
  const [isArchiveView, setIsArchiveView] = useState(false);
  const [demoArchiveOverrides, setDemoArchiveOverrides] = useState<Record<string, boolean>>({});
  const [logsLimit, setLogsLimit] = useState(25);
  const [difmLimit, setDifmLimit] = useState(25);
  const loadingRef = useRef<HTMLDivElement>(null);
  const difmLoadingRef = useRef<HTMLDivElement>(null);

  // Compute derived data
  const logs = useMemo<MaintenanceLog[]>(() => {
    if (!profile) return [];
    if (!isDemoMode) return firestoreLogs;
    const filteredMockLogs = demoLogs
      .map((log) => {
        const override =
          log.id && log.id in demoArchiveOverrides
            ? demoArchiveOverrides[log.id]
            : Boolean(log.isArchived);
        return { ...log, isArchived: override };
      })
      .filter((log) => Boolean(log.isArchived) === isArchiveView);
    return [...demoSeededLogs, ...filteredMockLogs];
  }, [profile, isDemoMode, isArchiveView, firestoreLogs, demoArchiveOverrides, demoSeededLogs]);

  const difm = useMemo<DIFMLog[]>(() => {
    if (!profile) return [];
    if (!isDemoMode) return firestoreDifm;
    return demoDifm;
  }, [profile, isDemoMode, firestoreDifm]);

  const personnelRoster = useMemo<UserProfile[]>(() => {
    if (isDemoMode) return demoPersonnel;
    return firestorePersonnelRoster;
  }, [isDemoMode, firestorePersonnelRoster]);

  const hasMoreLogs = useMemo(
    () => firestoreLogs.length >= logsLimit,
    [firestoreLogs.length, logsLimit]
  );
  const hasMoreDifm = useMemo(
    () => firestoreDifm.length >= difmLimit,
    [firestoreDifm.length, difmLimit]
  );

  // Personnel roster query
  useEffect(() => {
    if (!profile) return;
    if (isDemoMode) return;

    const rosterConstraints: QueryConstraint[] = [
      where('status', '==', 'active'),
      where('isDemo', '==', false),
    ];
    if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
      rosterConstraints.push(where('amuId', '==', profile.amuId));
    }
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
      rosterConstraints.push(where('shopId', '==', profile.shopId));
    }

    const qRoster = query(collection(db, 'users'), ...rosterConstraints);
    const unsub = onSnapshot(
      qRoster,
      (snap) => {
        setFirestorePersonnelRoster(snap.docs.map((d) => d.data() as UserProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => unsub();
  }, [profile, isDemoMode]);

  // Lazy loading observers
  useEffect(() => {
    if (!hasMoreLogs) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLogsLimit((prev) => prev + 25);
        }
      },
      { threshold: 1.0 }
    );

    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [hasMoreLogs]);

  useEffect(() => {
    if (!hasMoreDifm) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDifmLimit((prev) => prev + 25);
        }
      },
      { threshold: 1.0 }
    );

    if (difmLoadingRef.current) observer.observe(difmLoadingRef.current);
    return () => observer.disconnect();
  }, [hasMoreDifm]);

  // Main logs and DIFM query
  useEffect(() => {
    if (!profile || isDemoMode) return;

    const logConstraints: QueryConstraint[] = [
      where('isDemo', '==', false),
      orderBy('timestamp', 'desc'),
    ];
    if (profile.amuId !== 'ALL') logConstraints.push(where('amuId', '==', profile.amuId));
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP')
      logConstraints.push(where('shopId', '==', profile.shopId));

    const logConstraintsWithArchive: QueryConstraint[] = [
      ...logConstraints,
      where('isArchived', '==', isArchiveView),
      limit(logsLimit),
    ];
    const qLogs = query(collection(db, 'logs'), ...logConstraintsWithArchive);

    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        setFirestoreLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MaintenanceLog));
        setSnapshotError(null);
      },
      (error) => {
        const code = (error as { code?: string })?.code;
        const message = error instanceof Error ? error.message : String(error);
        console.error('Firestore Error:', {
          error: message,
          code,
          operationType: OperationType.LIST,
          path: 'logs',
        });
        setSnapshotError(code ? `${code}: ${message}` : message);
      }
    );

    const difmConstraints: QueryConstraint[] = [where('isDemo', '==', false)];
    if (profile.amuId !== 'ALL') difmConstraints.unshift(where('amuId', '==', profile.amuId));
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP')
      difmConstraints.unshift(where('shopId', '==', profile.shopId));
    const qDifm = query(collection(db, 'difm'), ...difmConstraints, limit(difmLimit));

    const unsubDifm = onSnapshot(
      qDifm,
      (snap) => {
        setFirestoreDifm(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DIFMLog));
      },
      (error) => {
        const code = (error as { code?: string })?.code;
        const message = error instanceof Error ? error.message : String(error);
        console.error('Firestore Error:', {
          error: message,
          code,
          operationType: OperationType.LIST,
          path: 'difm',
        });
        setSnapshotError(code ? `${code}: ${message}` : message);
      }
    );

    return () => {
      unsubLogs();
      unsubDifm();
    };
  }, [profile, isDemoMode, isArchiveView, logsLimit, difmLimit]);

  return {
    logs,
    difm,
    personnelRoster,
    snapshotError,
    hasMoreLogs,
    hasMoreDifm,
    loadingRef,
    difmLoadingRef,
    isArchiveView,
    setIsArchiveView,
    demoSeededLogs,
    setDemoSeededLogs,
    demoArchiveOverrides,
    setDemoArchiveOverrides,
  };
}
