export type UserRole = 'leadership' | 'ncoic' | 'technician' | 'pending';

export interface UserProfile {
  uid: string;
  name: string;
  man_number: string;
  shopId: string;
  role: UserRole;
  email: string;
  phone?: string;
  status: 'active' | 'pending' | 'rejected';
  createdAt?: any;
}

export interface MaintenanceLog {
  id?: string;
  tail_number: string;
  jcn?: string;
  discrepancy: string;
  repair: string;
  doc_number?: string;
  shopId: string;
  technician_name: string;
  man_number: string;
  personnel?: string[];
  timestamp: any; // Firestore Timestamp
  isRedBall?: boolean;
}

export interface TrainingRecord {
  id?: string;
  man_number: string;
  course_name: string;
  due_date: string; // ISO 8601
  shopId: string;
  status: 'current' | 'expiring' | 'expired';
}
