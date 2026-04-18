import type { Timestamp, FieldValue } from 'firebase/firestore';

/** Fields written with serverTimestamp() are FieldValue on send, Timestamp on read. */
export type FirestoreTime = Timestamp | FieldValue;

export type UserRole = 'leadership' | 'ncoic' | 'technician' | 'pending';
export type AMUType = 'BLACK' | 'GREEN' | 'SILVER' | 'BLUE' | 'NONE' | 'ALL';
export type ShiftType = 'Days' | 'Swings' | 'Nights' | 'Weekend Duty';

export const SHOPS = ['AVIONICS', 'CREW_CHIEFS', 'JETS', 'E&E', 'LEADERSHIP'] as const;
export type ShopType = typeof SHOPS[number];

export interface UserProfile {
  uid: string;
  name: string;
  rank: string;
  man_number: string;
  shopId: string;
  amuId: AMUType;
  role: UserRole;
  email: string;
  phone?: string;
  status: 'active' | 'pending' | 'rejected';
  createdAt?: FirestoreTime;
  isDemo?: boolean;
}

export interface MaintenanceLog {
  id?: string;
  tail_number: string;
  jcn?: string;
  discrepancy: string;
  repair: string;
  doc_number?: string;
  shopId: string;
  amuId: AMUType;
  technician_name: string;
  man_number: string;
  personnel?: string[];
  timestamp: FirestoreTime;
  isRedBall?: boolean;
  isDemo?: boolean;
  shift?: ShiftType;
  lastEditedBy?: string;
  lastEditedAt?: FirestoreTime;
  g081_photo?: string;
  g081_status?: 'pending' | 'verified';
  g081_verified_by?: string;
  g081_verified_at?: FirestoreTime;
  isArchived?: boolean;
  archivedAt?: FirestoreTime;
}

export interface TrainingRecord {
  id?: string;
  man_number: string;
  course_code?: string;
  course_name: string;
  due_date: string; // ISO 8601
  shopId: string;
  amuId: AMUType;
  status: 'current' | 'expiring' | 'expired';
  isDemo?: boolean;
}

export interface DIFMLog {
  id?: string;
  tail_number: string;
  discrepancy: string;
  doc_number?: string;
  nsn?: string;
  status: 'due-in' | 'awaiting-parts' | 'in-repair' | 'complete';
  pipeline_status: 'ordered' | 'en-route' | 'received' | 'bench-check' | 'installed';
  shopId: string;
  amuId: AMUType;
  technician_name: string;
  timestamp: FirestoreTime;
  isDemo?: boolean;
}

export type NotificationType = 'red-ball' | 'parts' | 'training' | 'system' | 'supply-risk' | 'g081-expiry';

export interface Notification {
  id?: string;
  userId?: string;
  shopId?: string;
  amuId?: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  timestamp: FirestoreTime;
  metadata?: Record<string, unknown>;
  isDemo?: boolean;
}

export interface UserPresence {
  userId: string;
  userName: string;
  location: string;
  activeAt: FirestoreTime;
  shopId: string;
  amuId: string;
  isDemo?: boolean;
}
