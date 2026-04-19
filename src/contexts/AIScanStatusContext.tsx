import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ClassifiedError } from '../lib/aiRetry';
import type { AIProvider } from '../lib/aiProvider';

export type ScanKind =
  | 'assistant'
  | 'supply-risk'
  | 'g081-expiry'
  | 'training'
  | 'diagnostics'
  | 'intelligence-feed';

export type ScanStatus = 'idle' | 'running' | 'success' | 'error';

export interface ScanState {
  status: ScanStatus;
  lastRunAt?: number;
  lastError?: { kind: ClassifiedError['kind']; message: string };
  /** Which provider answered most recently (sticky across runs that omit it). */
  lastSource?: AIProvider;
  runCount: number;
}

const SCAN_KINDS: ScanKind[] = [
  'assistant',
  'supply-risk',
  'g081-expiry',
  'training',
  'diagnostics',
  'intelligence-feed',
];

const initialState = (): Record<ScanKind, ScanState> =>
  SCAN_KINDS.reduce((acc, kind) => {
    acc[kind] = { status: 'idle', runCount: 0 };
    return acc;
  }, {} as Record<ScanKind, ScanState>);

interface AIScanStatusContextType {
  statuses: Record<ScanKind, ScanState>;
  reportStart: (kind: ScanKind) => void;
  reportSuccess: (kind: ScanKind, source?: AIProvider) => void;
  reportError: (kind: ScanKind, error: ClassifiedError, source?: AIProvider) => void;
}

const AIScanStatusContext = createContext<AIScanStatusContextType | undefined>(undefined);

export const useScanStatus = () => {
  const ctx = useContext(AIScanStatusContext);
  if (!ctx) throw new Error('useScanStatus must be used within AIScanStatusProvider');
  return ctx;
};

export const AIScanStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [statuses, setStatuses] = useState<Record<ScanKind, ScanState>>(initialState);

  const reportStart = useCallback((kind: ScanKind) => {
    setStatuses(prev => ({
      ...prev,
      [kind]: { ...prev[kind], status: 'running' },
    }));
  }, []);

  const reportSuccess = useCallback((kind: ScanKind, source?: AIProvider) => {
    setStatuses(prev => ({
      ...prev,
      [kind]: {
        status: 'success',
        lastRunAt: Date.now(),
        lastError: undefined,
        lastSource: source ?? prev[kind].lastSource,
        runCount: (prev[kind].runCount ?? 0) + 1,
      },
    }));
  }, []);

  const reportError = useCallback((kind: ScanKind, error: ClassifiedError, source?: AIProvider) => {
    setStatuses(prev => ({
      ...prev,
      [kind]: {
        status: 'error',
        lastRunAt: Date.now(),
        lastError: { kind: error.kind, message: error.message },
        lastSource: source ?? prev[kind].lastSource,
        runCount: (prev[kind].runCount ?? 0) + 1,
      },
    }));
  }, []);

  const value = useMemo(
    () => ({ statuses, reportStart, reportSuccess, reportError }),
    [statuses, reportStart, reportSuccess, reportError],
  );

  return <AIScanStatusContext.Provider value={value}>{children}</AIScanStatusContext.Provider>;
};
