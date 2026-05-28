import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContextInstance';
import { MOCK_LOGS, MOCK_DIFM, MOCK_PERSONNEL, MOCK_TRAINING } from '../mockData';
import type { MaintenanceLog, DIFMLog, UserProfile, TrainingRecord } from '../types';

interface DemoDataContextValue {
  isDemo: boolean;
  logs: MaintenanceLog[];
  difm: DIFMLog[];
  personnel: UserProfile[];
  training: TrainingRecord[];
}

const DemoDataContext = createContext<DemoDataContextValue>({
  isDemo: false,
  logs: [],
  difm: [],
  personnel: [],
  training: [],
});

/**
 * Provides mock data to all children when in demo mode.
 * When NOT in demo mode, children should use their own Firestore hooks.
 * This centralizes the mock data access pattern that was previously
 * duplicated across every page and hook.
 */
export const DemoDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDemoMode, profile } = useAuth();

  const value = useMemo<DemoDataContextValue>(() => {
    if (!isDemoMode || !profile) {
      return { isDemo: false, logs: [], difm: [], personnel: [], training: [] };
    }

    const isLeadership = profile.role === 'leadership';

    // Filter mock data based on user context
    const filteredLogs = MOCK_LOGS.filter((log) => {
      if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
      if (profile.amuId !== 'ALL' && log.amuId !== profile.amuId) return false;
      if (profile.shopId !== 'ALL' && log.shopId !== profile.shopId) return false;
      return true;
    });

    const filteredDifm = MOCK_DIFM.filter((d) => {
      if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
      if (profile.amuId !== 'ALL' && d.amuId !== profile.amuId) return false;
      if (profile.shopId !== 'ALL' && d.shopId !== profile.shopId) return false;
      return true;
    });

    const filteredPersonnel = MOCK_PERSONNEL.filter((p) => {
      if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
      if (profile.amuId !== 'ALL' && p.amuId !== profile.amuId) return false;
      if (profile.shopId !== 'ALL' && p.shopId !== profile.shopId) return false;
      return true;
    });

    const filteredTraining = MOCK_TRAINING.filter((t) => {
      if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
      if (profile.amuId !== 'ALL' && t.amuId !== profile.amuId) return false;
      if (profile.shopId !== 'ALL' && t.shopId !== profile.shopId) return false;
      return true;
    });

    return {
      isDemo: true,
      logs: filteredLogs,
      difm: filteredDifm,
      personnel: filteredPersonnel,
      training: filteredTraining,
    };
  }, [isDemoMode, profile]);

  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
};

/** Hook to access demo data context. Returns null for live mode. */
export const useDemoData = (): DemoDataContextValue => {
  return useContext(DemoDataContext);
};
