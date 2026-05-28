import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { useDemoData } from '../contexts/DemoDataProvider';

export interface UsePersonnelRosterReturn {
  personnel: UserProfile[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  shopFilter: string;
  setShopFilter: (shop: string) => void;
  filteredPersonnel: UserProfile[];
  stats: {
    total: number;
    active: number;
    pending: number;
  };
}

export function usePersonnelRoster(): UsePersonnelRosterReturn {
  const { profile, isDemoMode } = useAuth();
  const { personnel: demoPersonnel } = useDemoData();
  const [firestorePersonnel, setFirestorePersonnel] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [limitCount, setLimitCount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [shopFilter, setShopFilter] = useState('all');

  const personnel = useMemo(() => {
    if (isDemoMode) return demoPersonnel;
    return firestorePersonnel;
  }, [isDemoMode, firestorePersonnel]);

  const hasMore = personnel.length >= limitCount;
  const loadMore = () => setLimitCount((prev) => prev + 50);

  // Firestore query
  useEffect(() => {
    if (isDemoMode || !profile) return;

    setLoading(true);
    const constraints = [where('isDemo', '==', false)];

    if (profile.amuId !== 'ALL') {
      constraints.push(where('amuId', '==', profile.amuId));
    }
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
      constraints.push(where('shopId', '==', profile.shopId));
    }

    const q = query(collection(db, 'users'), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as UserProfile[];
        setFirestorePersonnel(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching personnel:', error);
        handleFirestoreError(error, OperationType.LIST, 'users');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isDemoMode, profile]);

  // Filtered personnel
  const filteredPersonnel = useMemo(() => {
    let result = personnel.slice(0, limitCount);

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.man_number.includes(searchQuery) ||
          p.email.toLowerCase().includes(q)
      );
    }

    // Shop filter
    if (shopFilter !== 'all') {
      result = result.filter((p) => p.shopId === shopFilter);
    }

    return result;
  }, [personnel, limitCount, searchQuery, shopFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: personnel.length,
      active: personnel.filter((p) => p.status === 'active').length,
      pending: personnel.filter((p) => p.status === 'pending').length,
    };
  }, [personnel]);

  return {
    personnel,
    loading,
    hasMore,
    loadMore,
    searchQuery,
    setSearchQuery,
    shopFilter,
    setShopFilter,
    filteredPersonnel,
    stats,
  };
}
