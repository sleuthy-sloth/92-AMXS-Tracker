export type UserRole = 'leadership' | 'ncoic' | 'technician' | 'pending';
export type AMUType = 'BLACK' | 'GREEN' | 'SILVER' | 'BLUE' | 'NONE';
export type ShiftType = 'Days' | 'Swings' | 'Nights' | 'Weekend Duty';

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
}

export interface TrainingRecord {
  id?: string;
  man_number: string;
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
  status: 'due-in' | 'awaiting-parts' | 'in-repair' | 'complete';
  shopId: string;
  amuId: AMUType;
  technician_name: string;
  timestamp: any; // Firestore Timestamp
  isDemo?: boolean;
}
