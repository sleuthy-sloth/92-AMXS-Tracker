import { User } from 'firebase/auth';
import { UserProfile, UserRole, AMUType } from '../types';
import { ShopType } from '../mockData';

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  signUpEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserPassword: (newPass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  bypassLogin: (role?: UserRole) => void;
  setShop: (shop: ShopType) => void;
  setAMU: (amu: AMUType) => void;
  setRole: (role: UserRole) => void;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
}
