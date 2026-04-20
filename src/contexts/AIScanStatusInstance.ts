import { createContext, useContext } from 'react';
import type { ClassifiedError } from '../lib/aiRetry';
import type { AIProvider } from '../lib/aiProvider';
import { ScanKind, ScanState } from './AIScanStatusTypes';

export interface AIScanStatusContextType {
  statuses: Record<ScanKind, ScanState>;
  reportStart: (kind: ScanKind) => void;
  reportSuccess: (kind: ScanKind, source?: AIProvider) => void;
  reportError: (kind: ScanKind, error: ClassifiedError, source?: AIProvider) => void;
}

export const AIScanStatusContext = createContext<AIScanStatusContextType | undefined>(undefined);

export const useScanStatus = () => {
  const ctx = useContext(AIScanStatusContext);
  if (!ctx) throw new Error('useScanStatus must be used within AIScanStatusProvider');
  return ctx;
};
