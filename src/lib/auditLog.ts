/**
 * Structured audit log for all write operations.
 * Logs who did what, when, and the before/after values.
 *
 * Usage:
 *   import { writeAuditLog } from '../lib/auditLog';
 *   await writeAuditLog('logs', logId, 'delete', { previousValue });
 *
 * Storage: Firestore collection `/audit_log/{autoId}`
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export type AuditAction = 'create' | 'update' | 'delete' | 'archive' | 'restore';

export interface AuditLogEntry {
  /** Firestore collection name (e.g. 'logs', 'trainings', 'users') */
  collectionName: string;
  /** Document ID that was modified */
  documentId: string | null;
  /** The action performed */
  action: AuditAction;
  /** UID of the user who performed the action */
  performedBy: string;
  /** Email of the user who performed the action */
  performedByEmail: string | null;
  /** ISO timestamp of when the action occurred */
  timestamp: ReturnType<typeof serverTimestamp>;
  /** Snapshot of the document before the change (for update/delete) */
  previousValue?: Record<string, unknown> | null;
  /** Snapshot of the document after the change (for create/update) */
  newValue?: Record<string, unknown> | null;
  /** Free-form human-readable summary */
  summary?: string;
}

/**
 * Write an audit log entry to Firestore.
 * This is best-effort — failures are logged to console but not thrown,
 * so audit logging doesn't block the primary operation.
 */
export async function writeAuditLog(
  collectionName: string,
  documentId: string | null,
  action: AuditAction,
  options?: {
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    summary?: string;
  }
): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    const entry: AuditLogEntry = {
      collectionName,
      documentId,
      action,
      performedBy: currentUser?.uid || 'unknown',
      performedByEmail: currentUser?.email || null,
      timestamp: serverTimestamp(),
      previousValue: options?.previousValue ?? null,
      newValue: options?.newValue ?? null,
      summary: options?.summary,
    };

    await addDoc(collection(db, 'audit_log'), entry);
  } catch (error) {
    // Audit logging is best-effort — don't crash the app
    console.warn('[AuditLog] Failed to write audit entry:', error);
  }
}
