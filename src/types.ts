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
  createdAt?: any;
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
  timestamp: any; // Firestore Timestamp
  isRedBall?: boolean;
  isDemo?: boolean;
  shift?: ShiftType;
  lastEditedBy?: string;
  lastEditedAt?: any;
  g081_photo?: string;
  g081_status?: 'pending' | 'verified';
  g081_verified_by?: string;
  g081_verified_at?: any;
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
  timestamp: any; // Firestore Timestamp
  isDemo?: boolean;
}

export type NotificationType = 'red-ball' | 'parts' | 'training' | 'system';

export interface Notification {
  id?: string;
  userId?: string;
  shopId?: string;
  amuId?: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  timestamp: any;
  metadata?: any;
  isDemo?: boolean;
}

export interface UserPresence {
  userId: string;
  userName: string;
  location: string;
  activeAt: any;
  shopId: string;
  amuId: string;
  isDemo?: boolean;
}
