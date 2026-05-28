import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TrainingRecord } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { useDemoData } from '../contexts/DemoDataProvider';

export interface UseTrainingDataReturn {
  trainings: TrainingRecord[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  statusFilter: 'all' | 'current' | 'expiring' | 'expired';
  setStatusFilter: (status: 'all' | 'current' | 'expiring' | 'expired') => void;
  filteredTrainings: TrainingRecord[];
  stats: {
    total: number;
    current: number;
    expiring: number;
    expired: number;
  };
}

export function useTrainingData(): UseTrainingDataReturn {
  const { profile, isDemoMode } = useAuth();
  const { training: demoTraining } = useDemoData();
  const [firestoreTrainings, setFirestoreTrainings] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [limitCount, setLimitCount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'expiring' | 'expired'>(
    'all'
  );

  const trainings = useMemo(() => {
    if (isDemoMode) return demoTraining;
    return firestoreTrainings;
  }, [isDemoMode, firestoreTrainings]);

  const hasMore = trainings.length >= limitCount;
  const loadMore = () => setLimitCount((prev) => prev + 50);
  useEffect(() => {
    if (isDemoMode || !profile) return;

    setLoading(true);
    const constraints = [where('isDemo', '==', false), orderBy('dueDate', 'asc')];

    if (profile.amuId !== 'ALL') {
      constraints.push(where('amuId', '==', profile.amuId));
    }
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
      constraints.push(where('shopId', '==', profile.shopId));
    }

    const q = query(collection(db, 'trainings'), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TrainingRecord[];
        setFirestoreTrainings(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching trainings:', error);
        handleFirestoreError(error, OperationType.LIST, 'trainings');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isDemoMode, profile]);

  // Filtered trainings
  const filteredTrainings = useMemo(() => {
    let result = trainings.slice(0, limitCount);

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.course_name.toLowerCase().includes(q) ||
          (t.course_code && t.course_code.toLowerCase().includes(q)) ||
          t.man_number.includes(searchQuery)
      );
    }

    // Date filter
    if (startDate) {
      result = result.filter((t) => t.due_date >= startDate);
    }
    if (endDate) {
      result = result.filter((t) => t.due_date <= endDate);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    return result;
  }, [trainings, limitCount, searchQuery, startDate, endDate, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: trainings.length,
      current: trainings.filter((t) => t.status === 'current').length,
      expiring: trainings.filter((t) => t.status === 'expiring').length,
      expired: trainings.filter((t) => t.status === 'expired').length,
    };
  }, [trainings]);

  return {
    trainings,
    loading,
    hasMore,
    loadMore,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    statusFilter,
    setStatusFilter,
    filteredTrainings,
    stats,
  };
}
