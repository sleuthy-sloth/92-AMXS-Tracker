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

export const SCAN_KINDS: ScanKind[] = [
  'assistant',
  'supply-risk',
  'g081-expiry',
  'training',
  'diagnostics',
  'intelligence-feed',
];
