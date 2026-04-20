import React, { useCallback, useMemo, useState } from 'react';
import type { ClassifiedError } from '../lib/aiRetry';
import type { AIProvider } from '../lib/aiProvider';
import { SCAN_KINDS, ScanKind, ScanState } from './AIScanStatusTypes';
import { AIScanStatusContext } from './AIScanStatusInstance';

const initialState = (): Record<ScanKind, ScanState> =>
  SCAN_KINDS.reduce((acc, kind) => {
    acc[kind] = { status: 'idle', runCount: 0 };
    return acc;
  }, {} as Record<ScanKind, ScanState>);

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
