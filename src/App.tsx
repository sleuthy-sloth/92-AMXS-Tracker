import { GoogleGenAI } from "@google/genai";
import React, { Component, createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation
} from 'react-router-dom';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  Terminal, 
  LayoutDashboard, 
  Users, 
  Wrench, 
  BarChart3, 
  LogOut, 
  Plus, 
  Search, 
  UploadCloud, 
  ShieldAlert,
  ShieldCheck,
  Menu,
  X,
  Send,
  Clock,
  FileDown,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Mail,
  Lock,
  List,
  Grid,
  MessageSquare,
  HelpCircle,
  Info,
  Bot,
  Sparkles
} from 'lucide-react';
import { format, addDays, isBefore, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db, handleFirestoreError, OperationType, FirestoreErrorInfo } from './firebase';

// --- Error Boundary ---

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayError = "Something went wrong.";
      let details = null;

      try {
        const parsed = JSON.parse(this.state.error.message) as FirestoreErrorInfo;
        if (parsed.error) {
          displayError = "Database Access Error";
          details = (
            <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-xl text-left">
              <p className="text-error font-bold text-sm">Operation: {parsed.operationType.toUpperCase()}</p>
              <p className="text-on-surface-variant text-xs mt-1">Path: {parsed.path || 'Unknown'}</p>
              <p className="text-on-surface text-sm mt-2 font-mono">{parsed.error}</p>
              <div className="mt-4 pt-4 border-t border-error/10">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Auth Context</p>
                <p className="text-xs text-on-surface-variant">User ID: {parsed.authInfo.userId || 'Not Logged In'}</p>
                <p className="text-xs text-on-surface-variant">Email: {parsed.authInfo.email || 'N/A'}</p>
              </div>
            </div>
          );
        }
      } catch (e) {
        displayError = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full sleek-card text-center space-y-6">
            <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto text-error">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-on-background tracking-tight">{displayError}</h2>
              <p className="text-on-surface-variant text-sm">
                The application encountered a critical error. Please try refreshing the page or contact support if the issue persists.
              </p>
            </div>
            {details}
            <button 
              onClick={() => window.location.reload()}
              className="sleek-button w-full bg-primary text-white"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import { cn } from './lib/utils';
import { UserProfile, MaintenanceLog, TrainingRecord, UserRole, AMUType, ShiftType, DIFMLog } from './types';
import { parseTrainingReport } from './services/parserService';
import { 
  exportLogsToCSV, 
  exportLogsToPDF, 
  exportTrainingToCSV, 
  exportTrainingToPDF 
} from './lib/exportUtils';
import { SHOPS, ShopType, AMUS, SHIFT_TIMES, MOCK_LOGS, MOCK_PERSONNEL, MOCK_TRAINING } from './mockData';

// --- Contexts ---

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const seedDatabase = async () => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('Seeding database...');
      const batch = writeBatch(db);
      
      MOCK_PERSONNEL.forEach(p => {
        batch.set(doc(db, 'users', p.uid), p);
      });
      
      MOCK_TRAINING.forEach(t => {
        batch.set(doc(db, 'training', t.id || `mock-${Math.random()}`), t);
      });
      
      MOCK_LOGS.forEach(l => {
        const logToSave = { ...l, timestamp: serverTimestamp() };
        batch.set(doc(db, 'logs', l.id || `mock-${Math.random()}`), logToSave);
      });
      
      await batch.commit();
      console.log('Database seeded successfully.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const toggleDemoMode = () => setIsDemoMode(prev => !prev);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid);
        // Seed database if admin logs in and it's empty
        if (currentUser.email === 'spkoehl@gmail.com') {
          await seedDatabase();
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signInEmail = async (email: string, pass: string) => {
    try {
      // Normalize 'admin' input to the admin email for Firebase Auth
      const loginEmail = email === 'admin' ? 'admin@us.af.mil' : email;
      await signInWithEmailAndPassword(auth, loginEmail, pass);
    } catch (error: any) {
      console.error('Email sign in error:', error);
      throw error;
    }
  };

  const signUpEmail = async (email: string, pass: string) => {
    try {
      // Normalize 'admin' input for registration
      const regEmail = email === 'admin' ? 'admin@us.af.mil' : email;
      await createUserWithEmailAndPassword(auth, regEmail, pass);
    } catch (error) {
      console.error('Email sign up error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const resetEmail = email === 'admin' ? 'admin@us.af.mil' : email;
      await sendPasswordResetEmail(auth, resetEmail);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const updateUserPassword = async (newPass: string) => {
    if (!auth.currentUser) throw new Error('No authenticated user');
    try {
      await updatePassword(auth.currentUser, newPass);
    } catch (error) {
      console.error('Password update error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const bypassLogin = (role: UserRole = 'ncoic') => {
    const mockUser = {
      uid: 'mock-user-preview',
      email: 'dev.preview@us.af.mil',
      displayName: 'PREVIEW USER',
    } as User;
    
    const mockProfile: UserProfile = {
      uid: 'mock-user-preview',
      name: 'PREVIEW USER',
      rank: 'TSgt',
      man_number: '99999',
      shopId: 'AVIONICS',
      amuId: 'BLACK',
      role: role,
      email: 'dev.preview@us.af.mil',
      phone: '555-0123',
      status: 'active',
      isDemo: true
    };
    
    setUser(mockUser);
    setProfile(mockProfile);
    setLoading(false);
    setIsDemoMode(true);
  };

  const setShop = async (shop: ShopType) => {
    if (profile) {
      const updatedProfile = { ...profile, shopId: shop };
      setProfile(updatedProfile);
      if (user && user.uid !== 'mock-user-123') {
        try {
          await updateDoc(doc(db, 'users', user.uid), { shopId: shop });
        } catch (e) {
          console.error('Error updating shop in Firestore', e);
        }
      }
    }
  };

  const setAMU = async (amu: AMUType) => {
    if (profile) {
      const updatedProfile = { ...profile, amuId: amu };
      setProfile(updatedProfile);
      if (user && user.uid !== 'mock-user-123') {
        try {
          await updateDoc(doc(db, 'users', user.uid), { amuId: amu });
        } catch (e) {
          console.error('Error updating AMU in Firestore', e);
        }
      }
    }
  };

  const setRole = async (role: UserRole) => {
    if (profile) {
      const updatedProfile = { ...profile, role: role };
      setProfile(updatedProfile);
      if (user && user.uid !== 'mock-user-123') {
        try {
          await updateDoc(doc(db, 'users', user.uid), { role: role });
        } catch (e) {
          console.error('Error updating role in Firestore', e);
        }
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signIn, 
      signInEmail,
      signUpEmail,
      resetPassword,
      updateUserPassword,
      logout, 
      refreshProfile, 
      bypassLogin, 
      setShop,
      setAMU,
      setRole,
      isDemoMode,
      toggleDemoMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Tour component removed

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, logout, setShop, setAMU, setRole, isDemoMode, toggleDemoMode } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [isAMUDropdownOpen, setIsAMUDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Maintenance Log', path: '/maintenance', icon: Wrench },
    { name: 'DIFM Log', path: '/difm', icon: FileDown },
    { name: 'Training Tracker', path: '/training', icon: BarChart3 },
    { name: 'Personnel', path: '/personnel', icon: Users },
    { name: 'Support', path: '/support', icon: HelpCircle },
  ];

  if (profile?.role === 'ncoic' || profile?.role === 'leadership') {
    navItems.push({ name: 'Onboarding', path: '/onboarding', icon: UserPlus });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[260px] bg-sidebar text-white transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col border-r border-white/10",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="logo flex items-center gap-3 px-8 py-10">
          <div className="logo-box w-10 h-10 bg-primary text-white rounded-none flex items-center justify-center font-black text-xl">
            92
          </div>
          <div>
            <div className="font-black text-lg tracking-[0.2em] uppercase leading-none text-white">AMXS</div>
            <div className="tech-label text-white/60 mt-1">Logistics Control</div>
          </div>
        </div>

        {isDemoMode && (
          <div className="px-8 pb-8 space-y-6 border-b border-white/10">
            <div className="relative">
              <p className="tech-label text-white/60 mb-2">Simulated Role</p>
              <button 
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 px-4 py-3 text-white hover:bg-white/10 transition-colors"
              >
                <span className="font-black text-[11px] tracking-widest uppercase">{profile?.role}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isRoleDropdownOpen && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {isRoleDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 w-full mt-2 bg-sidebar border border-white/10 shadow-2xl overflow-hidden z-50"
                  >
                    {['technician', 'ncoic', 'leadership'].map(role => (
                      <button
                        key={role}
                        onClick={() => {
                          setRole(role as UserRole);
                          setIsRoleDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 text-[11px] font-black tracking-widest hover:bg-white/10 transition-colors uppercase",
                          profile?.role === role ? "text-white bg-white/20" : "text-white/60"
                        )}
                      >
                        {role}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <p className="text-[11px] uppercase tracking-widest text-white/60 mb-2 font-bold">Preview AMU</p>
              <button 
                onClick={() => setIsAMUDropdownOpen(!isAMUDropdownOpen)}
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 text-white hover:bg-white/10 transition-colors"
              >
                <span className="font-bold">{profile?.amuId}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isAMUDropdownOpen && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {isAMUDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 w-full mt-2 bg-sidebar border border-white/10 shadow-xl overflow-hidden z-50"
                  >
                    {AMUS.map(amu => (
                      <button
                        key={amu}
                        onClick={() => {
                          setAMU(amu);
                          setIsAMUDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-xs hover:bg-white/10 transition-colors",
                          profile?.amuId === amu ? "text-primary font-bold" : "text-white/60"
                        )}
                      >
                        {amu}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <p className="text-[11px] uppercase tracking-widest text-white/60 mb-2 font-bold">Preview Shop</p>
              <button 
                onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 text-white hover:bg-white/10 transition-colors"
              >
                <span className="font-bold">{profile?.shopId}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isShopDropdownOpen && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {isShopDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 w-full mt-2 bg-sidebar border border-white/10 shadow-xl overflow-hidden z-50"
                  >
                    {SHOPS.map(shop => (
                      <button
                        key={shop}
                        onClick={() => {
                          setShop(shop);
                          setIsShopDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-xs hover:bg-white/10 transition-colors",
                          profile?.shopId === shop ? "text-primary font-bold" : "text-white/60"
                        )}
                      >
                        {shop}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        <nav className="flex-grow px-4 py-8 space-y-1">
          <p className="tech-label text-white/40 px-4 mb-4">Operations</p>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all",
                location.pathname === item.path 
                  ? "bg-white/10 text-primary border-r-2 border-primary" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-8 border-t border-white/10">
          {/* Demo Mode Toggle */}
          <div className="mb-8">
            <p className="tech-label text-white/40 mb-3">System Environment</p>
            <button 
              onClick={toggleDemoMode}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 transition-all border",
                isDemoMode 
                  ? "bg-caution-yellow/10 border-caution-yellow/30 text-caution-yellow" 
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              )}
            >
              <span className="font-black text-[10px] tracking-widest flex items-center gap-2 uppercase">
                {isDemoMode ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                {isDemoMode ? 'Sandbox' : 'Production'}
              </span>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                isDemoMode ? "bg-caution-yellow" : "bg-emerald-500"
              )} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/10 rounded-none flex items-center justify-center border border-white/10">
              <Users className="text-white w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-white truncate">{profile?.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">AMU: {profile?.amuId} • {profile?.shopId}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 hover:text-safety-orange transition-colors text-white/60 font-bold text-xs uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="flex justify-between items-start p-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {navItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
            </h1>
            <p className="text-slate-600 text-sm">92nd Aircraft Maintenance Squadron • Fairchild AFB</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="font-semibold text-slate-900">{profile?.rank} {profile?.name}</div>
            <div className="text-xs text-slate-600 uppercase tracking-wider">{profile?.role} • {profile?.amuId} • {profile?.shopId}</div>
          </div>
        </header>

        <div className="flex-1 px-8 pb-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center"
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </button>
    </div>
  );
};

// --- Pages ---

const Login: React.FC = () => {
  const { signIn, signInEmail, signUpEmail, resetPassword, bypassLogin } = useAuth();
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isResetMode) {
        await resetPassword(email);
        setMessage('Password reset email sent. Please check your inbox.');
        setIsResetMode(false);
      } else if (isSignUp) {
        await signUpEmail(email, password);
      } else {
        await signInEmail(email, password);
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      if (err.code === 'auth/invalid-credential') msg = 'Invalid credentials provided.';
      if (err.code === 'auth/user-not-found') msg = 'User account not found.';
// ...
      if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-sidebar border border-white/10 flex items-center justify-center shadow-2xl">
            <Terminal className="text-white w-12 h-12" />
          </div>
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">92ND AMXS</h1>
            <p className="serif-header text-lg mt-2 text-slate-600">Logistics Control & Training Oversight</p>
          </div>
        </div>
        
        <div className="visible-grid bg-surface p-10 space-y-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 -mr-16 -mt-16 rotate-45 pointer-events-none"></div>
          
          <p className="serif-header text-sm leading-relaxed text-slate-600">
            Access to the 92nd AMXS Maintenance & Training system is restricted to authorized personnel only. All activity is logged and monitored.
          </p>

          {!isEmailMode ? (
            <div className="space-y-6">
              <button 
                onClick={signIn}
                className="sleek-button w-full py-4 text-sm flex items-center justify-center gap-3"
              >
                <ShieldCheck className="w-5 h-5" />
                Authenticate with Google
              </button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline"></div></div>
                <div className="relative flex justify-center"><span className="bg-surface px-4 tech-label text-[8px]">Developer / Admin Access</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => bypassLogin('leadership')}
                  className="bg-white text-slate-900 border-2 border-slate-200 px-5 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-slate-50 active:scale-95 flex flex-col items-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5 text-safety-orange" />
                  <span>Demo Sandbox</span>
                </button>
                <button 
                  onClick={() => setIsEmailMode(true)}
                  className="bg-primary text-white border-2 border-primary px-5 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-primary/90 active:scale-95 flex flex-col items-center gap-2 shadow-lg"
                >
                  <Lock className="w-5 h-5 text-white" />
                  <span>Master Login</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-6 text-left">
              <div className="flex justify-between items-center mb-2">
                <h3 className="tech-label text-primary">
                  {isResetMode ? 'Password Recovery' : isSignUp ? 'New Account Registration' : 'System Credential Login'}
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setIsEmailMode(false);
                    setIsResetMode(false);
                  }}
                  className="text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
              </div>

              <div className="space-y-2">
                <label className="tech-label">System Email / Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="sleek-input pl-12 w-full" 
                    placeholder="admin or user@email.com" 
                  />
                </div>
              </div>

              {!isResetMode && (
                <div className="space-y-2">
                  <label className="tech-label">Access Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="sleek-input pl-12 w-full" 
                      placeholder="••••••••" 
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-safety-orange/10 border border-safety-orange/20 flex items-center gap-3 text-safety-orange text-[10px] font-black uppercase tracking-tight">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {message && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 text-[10px] font-black uppercase tracking-tight">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  {message}
                </div>
              )}

              <button type="submit" className="sleek-button w-full py-4 text-xs font-black">
                {isResetMode ? 'Send Recovery Email' : isSignUp ? 'Initialize Access' : 'Authenticate Credentials'}
              </button>

              <div className="pt-4 border-t border-outline flex flex-col gap-4">
                {!isResetMode && (
                  <button 
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[11px] font-black uppercase tracking-widest text-primary hover:underline"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : 'New Personnel? Register for Access'}
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsResetMode(!isResetMode)}
                  className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                >
                  {isResetMode ? 'Back to Sign In' : 'Forgot Access Password?'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const Setup: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    rank: '',
    man_number: '',
    shopId: '' as ShopType | '',
    amuId: '' as AMUType | '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const isMasterAdmin = user.email === 'spkoehl@gmail.com' || user.email === 'admin@us.af.mil' || user.email === 'admin';
      
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: formData.name,
        rank: formData.rank,
        man_number: formData.man_number,
        shopId: formData.shopId || 'PENDING',
        amuId: formData.amuId || 'NONE',
        phone: formData.phone,
        role: isMasterAdmin ? 'leadership' : 'pending',
        status: isMasterAdmin ? 'active' : 'pending',
        createdAt: serverTimestamp(),
        isDemo: false
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      await refreshProfile();
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.message || 'Setup submission failed. Please check your inputs or connectivity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-xl w-full space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">Access Request</h2>
          <p className="serif-header text-lg text-slate-600">Submit operational details for NCOIC verification</p>
        </div>

        <form onSubmit={handleSubmit} className="visible-grid bg-surface p-12 space-y-10 shadow-xl">
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="tech-label">Rank</label>
                <input 
                  required
                  className="sleek-input w-full"
                  placeholder="E.G. SrA"
                  value={formData.rank}
                  onChange={e => setFormData({...formData, rank: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="tech-label">Full Name (Surname, Initial)</label>
                <input 
                  required
                  className="sleek-input w-full"
                  placeholder="DOE, J"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="tech-label">Assigned AMU</label>
                <select 
                  required
                  className="sleek-input w-full"
                  value={formData.amuId}
                  onChange={e => setFormData({...formData, amuId: e.target.value as any})}
                >
                  <option value="">Select AMU...</option>
                  {AMUS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="tech-label">Assigned Shop</label>
                <select 
                  required
                  className="sleek-input w-full"
                  value={formData.shopId}
                  onChange={e => setFormData({...formData, shopId: e.target.value as any})}
                >
                  <option value="">Select Shop...</option>
                  {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="tech-label">Man Number</label>
              <input 
                required
                className="sleek-input w-full data-mono"
                placeholder="99999"
                value={formData.man_number}
                onChange={e => setFormData({...formData, man_number: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="tech-label">Contact Phone</label>
              <input 
                className="sleek-input w-full"
                placeholder="555-0123"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-safety-orange/10 border border-safety-orange/20 flex items-center gap-3 text-safety-orange text-[10px] font-black uppercase tracking-tight">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <button 
              type="submit"
              disabled={loading}
              className="sleek-button w-full py-5 text-lg"
            >
              {loading ? 'Transmitting Request...' : 'Request System Access'}
            </button>
            <button 
              type="button"
              onClick={logout}
              className="tech-label text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-[0.1em] text-center"
            >
              Sign Out & Try Different Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PendingApproval: React.FC = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-slate-50 border border-outline flex items-center justify-center">
            <Clock className="text-primary w-12 h-12" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-slate-900">Access Pending</h1>
            <p className="serif-header text-lg mt-2 text-slate-600">Your account is currently awaiting NCOIC verification.</p>
          </div>
        </div>
        
        <div className="visible-grid bg-surface p-10 space-y-8 shadow-xl">
          <p className="serif-header text-sm leading-relaxed text-slate-600">
            Once an administrator assigns your shop and validates your man number, you will be granted full operational access to the system.
          </p>
          <button 
            onClick={logout}
            className="sleek-button w-full py-4 bg-transparent \!text-slate-900 border border-outline hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

const Onboarding: React.FC = () => {
  const { profile } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rank: '',
    man_number: '',
    shopId: '' as ShopType | '',
    amuId: '' as AMUType | '',
    role: 'technician' as UserRole
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (selectedUser) {
      setFormData({
        name: selectedUser.name,
        rank: selectedUser.rank || '',
        man_number: selectedUser.man_number !== 'PENDING' ? selectedUser.man_number : '',
        shopId: selectedUser.shopId !== 'PENDING' ? (selectedUser.shopId as ShopType) : (profile?.shopId as ShopType) || '',
        amuId: selectedUser.amuId !== 'NONE' ? selectedUser.amuId : (profile?.amuId as AMUType) || '',
        role: 'technician'
      });
    }
  }, [selectedUser, profile]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', selectedUser.uid), {
        ...selectedUser,
        ...formData,
        status: 'active',
        isDemo: false
      });
      setSelectedUser(null);
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (uid: string) => {
    if (!window.confirm('Are you sure you want to reject this access request?')) return;
    try {
      await setDoc(doc(db, 'users', uid), { status: 'rejected' }, { merge: true });
    } catch (error) {
      console.error('Rejection error:', error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">Personnel Onboarding</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Review and approve system access requests</p>
        </div>
        <UserPlus className="text-primary w-12 h-12" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {pendingUsers.length > 0 ? pendingUsers.map(u => (
          <div key={u.uid} className="visible-grid bg-surface p-8 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-slate-50 border border-outline flex items-center justify-center text-primary">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tighter uppercase text-slate-900">{u.rank} {u.name}</h3>
                <p className="tech-label text-slate-500">{u.email}</p>
                <div className="flex gap-4 mt-3">
                  <span className="tech-label bg-slate-50 px-2 py-0.5 text-slate-600">SHOP: {u.shopId}</span>
                  <span className="tech-label bg-slate-50 px-2 py-0.5 text-slate-600">MAN #: {u.man_number}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedUser(u)}
                className="sleek-button px-8 py-3"
              >
                Approve & Assign
              </button>
              <button 
                onClick={() => handleReject(u.uid)}
                className="sleek-button bg-transparent !text-safety-orange border border-outline hover:bg-safety-orange/10 px-8 py-3"
              >
                Reject
              </button>
            </div>
          </div>
        )) : (
          <div className="visible-grid bg-surface py-24 text-center space-y-4 border-dashed">
            <Clock className="w-12 h-12 text-slate-200 mx-auto" />
            <p className="tech-label text-slate-400 uppercase tracking-[0.3em]">No pending access requests found.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface w-full max-w-2xl rounded-none shadow-2xl border border-outline overflow-hidden"
            >
              <div className="p-10 border-b border-outline bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">Onboard Personnel</h3>
                  <p className="tech-label mt-3 text-slate-500">Assign credentials for {selectedUser.name}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 transition-colors text-slate-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleApprove} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label">Full Name</label>
                    <input 
                      required
                      className="sleek-input w-full"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">Man Number</label>
                    <input 
                      required
                      className="sleek-input w-full data-mono"
                      placeholder="00000"
                      value={formData.man_number}
                      onChange={e => setFormData({...formData, man_number: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">AMU Assignment</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.amuId}
                      onChange={e => setFormData({...formData, amuId: e.target.value as AMUType})}
                    >
                      {AMUS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">Shop Assignment</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.shopId}
                      onChange={e => setFormData({...formData, shopId: e.target.value as ShopType})}
                    >
                      {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">System Role</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    >
                      <option value="technician">Technician</option>
                      <option value="ncoic">NCOIC</option>
                      <option value="leadership">Leadership</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">Rank</label>
                    <input 
                      required
                      className="sleek-input w-full"
                      value={formData.rank}
                      onChange={e => setFormData({...formData, rank: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="sleek-button bg-transparent \!text-slate-900 border border-outline hover:bg-slate-100 flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="sleek-button flex-1"
                  >
                    {loading ? 'Processing...' : 'Approve Access'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const isLeadership = profile.role === 'leadership';
      
      const filteredMockLogs = MOCK_LOGS.filter(l => {
        if (isLeadership) return true;
        return l.amuId === profile.amuId && l.shopId === profile.shopId;
      }).sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
      setLogs(filteredMockLogs);

      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (isLeadership) return true;
        return p.amuId === profile.amuId && p.shopId === profile.shopId;
      });
      setPersonnel(filteredMockPersonnel);

      const filteredMockTraining = MOCK_TRAINING.filter(t => {
        if (isLeadership) return true;
        return t.amuId === profile.amuId && t.shopId === profile.shopId;
      });
      setTraining(filteredMockTraining);
      return;
    }

    const isLeadership = profile.role === 'leadership';

    let qLogs;
    if (isLeadership) {
      qLogs = query(
        collection(db, 'logs'), 
        where('isDemo', '==', false),
        orderBy('timestamp', 'desc')
      );
    } else {
      qLogs = query(
        collection(db, 'logs'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId), 
        where('isDemo', '==', false),
        orderBy('timestamp', 'desc')
      );
    }
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));

    let qPersonnel;
    if (isLeadership) {
      qPersonnel = query(
        collection(db, 'users'),
        where('isDemo', '==', false)
      );
    } else {
      qPersonnel = query(
        collection(db, 'users'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }
    
    const unsubPersonnel = onSnapshot(qPersonnel, (snap) => {
      setPersonnel(snap.docs.map(d => d.data() as UserProfile));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    let qTraining;
    if (isLeadership) {
      qTraining = query(
        collection(db, 'training'),
        where('isDemo', '==', false)
      );
    } else {
      qTraining = query(
        collection(db, 'training'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }
    
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setTraining(snap.docs.map(d => d.data() as TrainingRecord));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'training'));

    return () => {
      unsubLogs();
      unsubPersonnel();
      unsubTraining();
    };
  }, [profile, isDemoMode]);

  const urgentLogs = logs.filter(l => l.isRedBall).length;
  const currentTraining = training.filter(t => t.status === 'current').length;
  const totalTraining = training.length || 1;
  const readiness = Math.round((currentTraining / totalTraining) * 100);

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-4xl font-black tracking-tighter uppercase">Command Dashboard</h2>
        <p className="serif-header text-lg mt-1">Real-time operational readiness and maintenance oversight</p>
      </header>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 visible-grid">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:col-span-2 md:row-span-2 p-10 flex flex-col justify-between bg-surface"
        >
          <div>
            <p className="tech-label mb-2">Personnel Readiness</p>
            <h3 className="text-8xl font-black tracking-tighter text-primary">{readiness}%</h3>
          </div>
          <div className="mt-10">
            <p className="tech-label mb-4">Readiness Matrix</p>
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 100 }).map((_, i) => {
                const isActive = i < readiness;
                const isExpiring = !isActive && i < (readiness + (training.filter(t => t.status === 'expiring').length / totalTraining * 100));
                return (
                  <div 
                    key={i} 
                    className={cn(
                      "aspect-square rounded-none transition-all duration-500",
                      isActive ? "bg-primary" : (isExpiring ? "bg-caution-yellow" : "bg-outline/20")
                    )} 
                  />
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8 flex flex-col justify-between bg-surface"
        >
          <p className="tech-label">Active Logs</p>
          <div className="text-5xl font-black tracking-tighter mt-4">{logs.length}</div>
          <p className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-widest mt-2">Open Discrepancies</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-8 flex flex-col justify-between bg-surface border-l border-outline"
        >
          <p className="tech-label text-safety-orange font-bold">Red Ball Items</p>
          <div className="text-5xl font-black tracking-tighter text-safety-orange mt-4">{urgentLogs}</div>
          <p className="text-[11px] font-bold text-safety-orange/70 uppercase tracking-widest mt-2">Urgent Maintenance</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 flex flex-col justify-between bg-surface border-l border-outline"
        >
          <p className="tech-label text-caution-yellow font-bold">Expiring Training</p>
          <div className="text-5xl font-black tracking-tighter text-caution-yellow mt-4">
            {training.filter(t => t.status === 'expiring').length}
          </div>
          <p className="text-[11px] font-bold text-caution-yellow/70 uppercase tracking-widest mt-2">Due &lt; 60 Days</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-8 flex flex-col justify-between bg-surface border-l border-outline"
        >
          <p className="tech-label text-safety-orange font-bold">Overdue Training</p>
          <div className="text-5xl font-black tracking-tighter text-safety-orange mt-4">
            {training.filter(t => t.status === 'expired').length}
          </div>
          <p className="text-[11px] font-bold text-safety-orange/70 uppercase tracking-widest mt-2">Immediate Action</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Personnel Roster */}
        <div className="lg:col-span-12">
          <div className="visible-grid bg-surface">
            <div className="p-8 flex justify-between items-center border-b border-outline">
              <div>
                <h3 className="text-2xl font-black tracking-tighter uppercase">Personnel Roster</h3>
                <p className="serif-header text-sm text-slate-600">Active duty personnel and qualification status</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input className="sleek-input pl-10 py-2 text-xs w-80 !bg-background" placeholder="Filter Roster..." />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-putty/50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                    <th className="px-8 py-5">Name / Rank</th>
                    <th className="px-8 py-5">Man Number</th>
                    {profile?.role === 'leadership' && <th className="px-8 py-5">Shop</th>}
                    <th className="px-8 py-5">Role</th>
                    <th className="px-8 py-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {personnel.map((p, idx) => (
                    <motion.tr 
                      key={p.uid} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover-invert"
                    >
                      <td className="px-8 py-5">
                        <p className="font-black text-sm tracking-tight uppercase">{p.name}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant uppercase mt-0.5">{p.rank} // {p.email}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className="data-mono text-sm">{p.man_number}</span>
                      </td>
                      {profile?.role === 'leadership' && (
                        <td className="px-8 py-5">
                          <span className="tech-label">{p.shopId}</span>
                        </td>
                      )}
                      <td className="px-8 py-5">
                        <span className={cn(
                          "badge",
                          p.role === 'ncoic' ? "badge-info" : "bg-outline/30 text-on-surface-variant"
                        )}>
                          {p.role}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                          <span className="tech-label text-[10px] font-bold">Active</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MaintenanceLogs: React.FC = () => {
  const { user, profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tail_number: '',
    jcn: '',
    discrepancy: '',
    repair: '',
    doc_number: '',
    personnelInput: '',
    isRedBall: false,
    shift: 'Days' as ShiftType
  });
  const [loading, setLoading] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const isLeadership = profile.role === 'leadership';
      const filteredMockLogs = MOCK_LOGS.filter(log => {
        if (isLeadership) return true;
        return log.amuId === profile.amuId && log.shopId === profile.shopId;
      });
      setLogs(filteredMockLogs);
      return;
    }

    const isLeadership = profile.role === 'leadership';

    let q;
    if (isLeadership) {
      q = query(
        collection(db, 'logs'), 
        where('isDemo', '==', false),
        orderBy('timestamp', 'desc')
      );
    } else {
      q = query(
        collection(db, 'logs'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId), 
        where('isDemo', '==', false),
        orderBy('timestamp', 'desc')
      );
    }
    
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));
    return unsub;
  }, [profile, isDemoMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (user?.uid === 'mock-user-preview') {
      alert('Demo users cannot modify the live database. This entry will not be saved.');
      setIsModalOpen(false);
      return;
    }

    setLoading(true);
    
    const personnelArray = formData.personnelInput.split(',').map(p => p.trim()).filter(p => p);
    
    try {
      if (editingLogId) {
        await updateDoc(doc(db, 'logs', editingLogId), {
          tail_number: formData.tail_number,
          jcn: formData.jcn,
          discrepancy: formData.discrepancy,
          repair: formData.repair,
          doc_number: formData.doc_number,
          isRedBall: formData.isRedBall,
          personnel: personnelArray,
          shift: formData.shift,
          lastEditedBy: profile.name,
          lastEditedAt: serverTimestamp()
        });
      } else {
        const newLog: MaintenanceLog = {
          tail_number: formData.tail_number,
          jcn: formData.jcn,
          discrepancy: formData.discrepancy,
          repair: formData.repair,
          doc_number: formData.doc_number,
          isRedBall: formData.isRedBall,
          shopId: profile.shopId,
          amuId: profile.amuId,
          technician_name: profile.name,
          man_number: profile.man_number,
          personnel: personnelArray,
          shift: formData.shift,
          timestamp: serverTimestamp(),
          isDemo: isDemoMode
        };
        await addDoc(collection(db, 'logs'), newLog);
      }
      setIsModalOpen(false);
      setEditingLogId(null);
      setFormData({ tail_number: '', jcn: '', discrepancy: '', repair: '', doc_number: '', personnelInput: '', isRedBall: false, shift: 'Days' });
    } catch (error) {
      handleFirestoreError(error, editingLogId ? OperationType.UPDATE : OperationType.CREATE, 'logs');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (log: MaintenanceLog) => {
    setFormData({
      tail_number: log.tail_number,
      jcn: log.jcn || '',
      discrepancy: log.discrepancy,
      repair: log.repair,
      doc_number: log.doc_number || '',
      personnelInput: log.personnel?.join(', ') || '',
      isRedBall: log.isRedBall || false,
      shift: log.shift || 'Days'
    });
    setEditingLogId(log.id!);
    setSelectedLog(null);
    setIsModalOpen(true);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.tail_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.technician_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.discrepancy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.jcn && log.jcn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.personnel && log.personnel.some(p => p.toLowerCase().includes(searchQuery.toLowerCase())));
      
    let matchesDate = true;
    if (startDate || endDate) {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
      if (startDate) matchesDate = matchesDate && logDate >= new Date(startDate);
      if (endDate) matchesDate = matchesDate && logDate <= new Date(endDate);
    }
    
    return matchesSearch && matchesDate;
  });

  const [selectedLog, setSelectedLog] = useState<MaintenanceLog | null>(null);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">Maintenance Logs</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Real-time turnover and discrepancy tracking</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex bg-surface border border-outline p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 transition-colors", viewMode === 'grid' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface")}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 transition-colors", viewMode === 'list' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
            <div className="flex gap-2">
              <button 
                onClick={() => exportLogsToCSV(filteredLogs, profile.shopId)}
                className="sleek-button bg-surface \!text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export CSV"
              >
                <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button 
                onClick={() => exportLogsToPDF(filteredLogs, profile.shopId)}
                className="sleek-button bg-surface \!text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export PDF"
              >
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="sleek-button flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Entry
          </button>
        </div>
      </div>

      {/* Shift Timeline Visualization */}
      <div className="visible-grid bg-surface p-8">
        <p className="tech-label mb-6 uppercase tracking-widest">Aero-Maintenance Activity Heatmap (24H)</p>
        <div className="relative h-12 bg-background border border-outline flex items-center overflow-hidden">
          <div className="absolute inset-0 flex">
            {/* Nights 1 (0000-0700) */}
            <div className="h-full bg-slate-100 flex items-center justify-center border-r border-outline" style={{ width: '29.16%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase">Nights</span>
            </div>
            {/* Days (0700-1500) */}
            <div className="h-full bg-primary/10 flex items-center justify-center border-r border-outline" style={{ width: '33.33%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase text-primary">Days</span>
            </div>
            {/* Swings (1500-2300) */}
            <div className="h-full bg-caution-yellow/10 flex items-center justify-center border-r border-outline" style={{ width: '33.33%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase text-caution-yellow">Swings</span>
            </div>
            {/* Nights 2 (2300-2400) */}
            <div className="h-full bg-slate-100 flex items-center justify-center" style={{ width: '4.18%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase">Nights</span>
            </div>
          </div>
          <div className="absolute inset-0 flex px-2 pointer-events-none">
            {filteredLogs.slice(0, 50).map((log, i) => {
              const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
              const hours = date.getHours();
              const minutes = date.getMinutes();
              const left = ((hours * 60 + minutes) / (24 * 60)) * 100;
              return (
                <div 
                  key={log.id || i}
                  className={cn(
                    "absolute w-1.5 h-6 -translate-x-1/2 transition-all hover:h-8 hover:z-10 cursor-pointer pointer-events-auto",
                    log.isRedBall ? "bg-safety-orange shadow-[0_0_8px_rgba(255,103,31,0.5)]" : "bg-primary"
                  )}
                  style={{ left: `${left}%` }}
                  title={`${log.tail_number} [${log.shift}]: ${log.discrepancy}`}
                  onClick={() => setSelectedLog(log)}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-between mt-3 px-1 border-t border-outline/30 pt-4">
          <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-slate-200"></div> Nights (23-07)</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-primary/20"></div> Days (07-15)</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-caution-yellow/20"></div> Swings (15-23)</div>
          </div>
          <p className="tech-label text-[8px] opacity-40 font-mono">24H OPERATIONAL CYCLE</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-0 visible-grid bg-surface">
        <div className="flex-1 relative p-4">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Search by tail number, name, JCN, or discrepancy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-12 w-full !border-none !bg-transparent"
          />
        </div>
        <div className="flex gap-0">
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Start Date</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">End Date</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="visible-grid bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                  <th className="px-8 py-5">Tail / JCN</th>
                  <th className="px-8 py-5">Date / Shift</th>
                  <th className="px-8 py-5">Personnel</th>
                  <th className="px-8 py-5">Discrepancy</th>
                  <th className="px-8 py-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {filteredLogs.map((log, idx) => (
                  <motion.tr 
                    key={log.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="hover-invert cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-8 py-5">
                      <div className="data-mono text-sm font-black">{log.tail_number}</div>
                      <div className="tech-label text-[10px] mt-1 opacity-70 font-bold">{log.jcn || `ID: #${log.id?.slice(0, 6)}`}</div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="data-mono text-xs">
                        {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy.MM.dd') : 'Pending'}
                      </div>
                      {log.shift && <span className="tech-label text-[10px] mt-1 block opacity-70 font-bold">{log.shift} Shift</span>}
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-[12px] uppercase tracking-tight text-slate-900">{log.technician_name}</p>
                      {log.personnel && log.personnel.length > 0 && (
                        <p className="tech-label text-[10px] mt-1 text-slate-500 font-bold">+{log.personnel.length} Support</p>
                      )}
                    </td>
                    <td className="px-8 py-5 max-w-xs">
                      <p className="serif-header text-xs line-clamp-2 text-slate-600">{log.discrepancy}</p>
                    </td>
                    <td className="px-8 py-5">
                      {log.isRedBall ? (
                        <span className="badge badge-danger">RED BALL</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500">NORMAL</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 visible-grid bg-white">
          <AnimatePresence>
            {filteredLogs.map((log, idx) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className="p-8 flex flex-col justify-between hover:bg-putty/50 transition-colors cursor-pointer group"
                onClick={() => setSelectedLog(log)}
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="tech-label mb-1 text-slate-500">
                        {log.jcn ? `JCN: ${log.jcn}` : `ID: #${log.id?.slice(0, 6)}`}
                      </p>
                      <h3 className="text-2xl font-black tracking-tighter uppercase group-hover:text-primary transition-colors text-slate-900">{log.tail_number}</h3>
                    </div>
                    {log.isRedBall && (
                      <span className="badge badge-danger">Red Ball</span>
                    )}
                  </div>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-outline pb-2">
                      <span className="tech-label !text-[9px]">Lead Tech</span>
                      <span className="font-black text-[10px] uppercase tracking-tight">
                        {log.technician_name}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-outline pb-2">
                      <span className="tech-label !text-[9px]">Timestamp</span>
                      <span className="data-mono text-[10px]">
                        {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy.MM.dd') : 'Pending'}
                        {log.shift && <span className="ml-2 opacity-60">[{log.shift} {SHIFT_TIMES[log.shift]}]</span>}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="tech-label !text-[9px] text-primary">Discrepancy</span>
                      <p className="serif-header text-sm leading-relaxed line-clamp-3">{log.discrepancy}</p>
                    </div>
                  </div>
                </div>
                
                <div className="tech-label !text-[9px] text-primary group-hover:translate-x-1 transition-transform flex items-center gap-2">
                  View Details <ChevronRight className="w-3 h-3" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Log Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-2xl w-full rounded-none shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-8 border-b border-outline flex justify-between items-center bg-putty/30">
                <div>
                  <h3 className="font-black text-3xl tracking-tighter uppercase">{selectedLog.tail_number}</h3>
                  <p className="tech-label mt-1 opacity-60">
                    {selectedLog.jcn ? `JCN: ${selectedLog.jcn}` : `Log ID: #${selectedLog.id?.slice(0, 6)}`}
                  </p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-100 transition-colors text-slate-900">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                    <span className="tech-label">Primary Technician</span>
                    <p className="font-black text-sm uppercase tracking-tight">{selectedLog.technician_name}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="tech-label">Date Logged</span>
                    <p className="data-mono text-sm">
                      {selectedLog.timestamp?.toDate ? format(selectedLog.timestamp.toDate(), 'MMMM dd, yyyy HH:mm') : 'Pending'}
                      {selectedLog.shift && <span className="ml-3 tech-label !text-[8px] bg-putty px-2 py-1">{selectedLog.shift} ({SHIFT_TIMES[selectedLog.shift]})</span>}
                    </p>
                  </div>
                </div>

                {selectedLog.personnel && selectedLog.personnel.length > 0 && (
                  <div className="space-y-3">
                    <span className="tech-label">Additional Personnel</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedLog.personnel.map((p, i) => (
                        <span key={i} className="px-3 py-1.5 bg-putty text-[10px] font-black uppercase tracking-widest">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="p-6 bg-safety-orange/5 border-l-4 border-safety-orange">
                    <span className="tech-label text-safety-orange flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-3 h-3" /> Discrepancy
                    </span>
                    <p className="serif-header text-base leading-relaxed text-on-surface">{selectedLog.discrepancy}</p>
                  </div>
                  <div className="p-6 bg-primary/5 border-l-4 border-primary">
                    <span className="tech-label text-primary flex items-center gap-2 mb-3">
                      <Wrench className="w-3 h-3" /> Repair Action
                    </span>
                    <p className="text-sm leading-relaxed text-on-surface font-medium">{selectedLog.repair}</p>
                  </div>
                </div>

                {selectedLog.doc_number && (
                  <div className="space-y-2">
                    <span className="tech-label">Document Number</span>
                    <p className="data-mono text-base text-primary font-black">{selectedLog.doc_number}</p>
                  </div>
                )}
              </div>
              
              <div className="p-8 border-t border-outline bg-slate-50 flex justify-between items-center">
                <div className="tech-label !text-[8px] opacity-50">
                  {selectedLog.lastEditedBy && (
                    <span>Last edited by {selectedLog.lastEditedBy} {selectedLog.lastEditedAt?.toDate && `on ${format(selectedLog.lastEditedAt.toDate(), 'MM/dd HH:mm')}`}</span>
                  )}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleEditClick(selectedLog)}
                    className="sleek-button bg-white !text-on-surface border border-outline hover:bg-putty"
                  >
                    Edit Entry
                  </button>
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="sleek-button px-10"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entry Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-2xl w-full rounded-none shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-8 border-b border-outline flex justify-between items-center bg-putty/30">
                <h3 className="font-black text-2xl tracking-tighter uppercase">{editingLogId ? 'Edit Maintenance Entry' : 'New Maintenance Entry'}</h3>
                <button onClick={() => { setIsModalOpen(false); setEditingLogId(null); }} className="p-2 hover:bg-putty transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Tail Number</label>
                    <input 
                      required
                      className="sleek-input w-full"
                      placeholder="AF-00-0000"
                      value={formData.tail_number}
                      onChange={e => setFormData({...formData, tail_number: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">JCN (Job Control Number)</label>
                    <input 
                      className="sleek-input w-full"
                      placeholder="E.G. 231450012"
                      value={formData.jcn}
                      onChange={e => setFormData({...formData, jcn: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="tech-label !text-[9px]">Additional Personnel (Comma Separated)</label>
                  <input 
                    className="sleek-input w-full"
                    placeholder="E.G. Smith J, Doe A"
                    value={formData.personnelInput}
                    onChange={e => setFormData({...formData, personnelInput: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Priority Status</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, isRedBall: !formData.isRedBall})}
                      className={cn(
                        "sleek-input w-full flex items-center justify-center gap-3 transition-colors",
                        formData.isRedBall ? "bg-safety-orange text-white border-safety-orange font-black" : "bg-putty/30 text-on-surface-variant"
                      )}
                    >
                      <ShieldAlert className="w-4 h-4" /> {formData.isRedBall ? 'RED BALL' : 'NORMAL'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Shift Assignment</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.shift}
                      onChange={e => setFormData({...formData, shift: e.target.value as ShiftType})}
                    >
                      {Object.entries(SHIFT_TIMES).map(([shift, time]) => (
                        <option key={shift} value={shift}>
                          {shift} ({time})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Discrepancy Report</label>
                    <textarea 
                      required
                      rows={3}
                      className="sleek-input w-full resize-none serif-header"
                      placeholder="Describe the malfunction or inspection requirement..."
                      value={formData.discrepancy}
                      onChange={e => setFormData({...formData, discrepancy: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Repair Action Taken</label>
                    <textarea 
                      required
                      rows={3}
                      className="sleek-input w-full resize-none"
                      placeholder="Describe the corrective action or turnover status..."
                      value={formData.repair}
                      onChange={e => setFormData({...formData, repair: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="tech-label !text-[9px]">Document Number (Optional)</label>
                  <input 
                    className="sleek-input w-full data-mono"
                    placeholder="E.G. 92144A001"
                    value={formData.doc_number}
                    onChange={e => setFormData({...formData, doc_number: e.target.value})}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="sleek-button w-full flex items-center justify-center gap-4 py-4 text-base"
                >
                  {loading ? 'Transmitting Data...' : 'Submit Operational Entry'} <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DIFMLogs: React.FC = () => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<DIFMLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tail_number: '',
    discrepancy: '',
    status: 'due-in' as 'due-in' | 'awaiting-parts' | 'in-repair' | 'complete'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'difm'), where('shopId', '==', profile.shopId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DIFMLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'difm');
    });
    return unsubscribe;
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'difm'), {
        ...formData,
        shopId: profile.shopId,
        amuId: profile.amuId,
        technician_name: profile.name,
        timestamp: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({ tail_number: '', discrepancy: '', status: 'due-in' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'difm');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const docRef = doc(db, 'difm', id);
      await updateDoc(docRef, { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `difm/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirm removal of this DIFM track?')) return;
    try {
      await deleteDoc(doc(db, 'difm', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `difm/${id}`);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">DIFM Oversight</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Due-In From Maintenance status and discrepancy tracking</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="sleek-button flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> New Track
        </button>
      </div>

      <div className="visible-grid bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                <th className="px-8 py-5">Tail Number</th>
                <th className="px-8 py-5">Discrepancy</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {logs.map((log, idx) => (
                <motion.tr 
                  key={log.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover:bg-slate-50/50"
                >
                  <td className="px-8 py-5">
                    <p className="font-black text-sm tracking-tight uppercase text-slate-900">{log.tail_number}</p>
                    <p className="tech-label text-[10px] mt-1 text-slate-500 font-bold">{log.technician_name}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="serif-header text-xs text-slate-600 max-w-md line-clamp-2">{log.discrepancy}</p>
                  </td>
                  <td className="px-8 py-5">
                    <select 
                      value={log.status}
                      onChange={(e) => handleStatusUpdate(log.id!, e.target.value)}
                      className={cn(
                        "badge cursor-pointer appearance-none text-center min-w-[120px]",
                        log.status === 'complete' ? "badge-success" : 
                        log.status === 'awaiting-parts' ? "badge-danger" : 
                        log.status === 'in-repair' ? "badge-warning" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <option value="due-in">DUE-IN</option>
                      <option value="awaiting-parts">AWAITING PARTS</option>
                      <option value="in-repair">IN REPAIR</option>
                      <option value="complete">COMPLETE</option>
                    </select>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => handleDelete(log.id!)}
                      className="p-2 text-slate-300 hover:text-safety-orange transition-colors"
                      title="Remove Track"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <p className="tech-label text-slate-400">No active DIFM tracks found for your shop.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-md w-full rounded-none shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-8 border-b border-outline bg-putty/30 flex justify-between items-center">
                <h3 className="font-black text-2xl tracking-tighter uppercase">Initiate DIFM Track</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 transition-colors text-slate-900">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-10 space-y-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="tech-label">Tail Number</label>
                    <input 
                      type="text" 
                      required
                      value={formData.tail_number}
                      onChange={(e) => setFormData({...formData, tail_number: e.target.value.toUpperCase()})}
                      className="sleek-input w-full uppercase" 
                      placeholder="e.g. 58-0092"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="tech-label">Maintenance Discrepancy</label>
                    <textarea 
                      required
                      rows={4}
                      value={formData.discrepancy}
                      onChange={(e) => setFormData({...formData, discrepancy: e.target.value})}
                      className="sleek-input w-full resize-none" 
                      placeholder="Detailed description of the required repair..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="tech-label">Initial Track Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="sleek-input w-full"
                    >
                      <option value="due-in">Due-In</option>
                      <option value="awaiting-parts">Awaiting Parts</option>
                      <option value="in-repair">In Repair</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 border-2 border-slate-200 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                  >
                    {loading ? 'Initializing...' : 'Commit Track'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TrainingTracker: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);

  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const isLeadership = profile.role === 'leadership';
      const isTechnician = profile.role === 'technician';
      
      const filteredMockTraining = MOCK_TRAINING.filter(t => {
        if (isLeadership) return true;
        if (isTechnician) return t.man_number === profile.man_number;
        return t.amuId === profile.amuId && t.shopId === profile.shopId;
      });
      setTraining(filteredMockTraining);

      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (isLeadership) return true;
        if (isTechnician) return p.man_number === profile.man_number;
        return p.amuId === profile.amuId && p.shopId === profile.shopId;
      });
      setPersonnel(filteredMockPersonnel);
      return;
    }

    const isLeadership = profile.role === 'leadership';
    const isTechnician = profile.role === 'technician';

    let qTraining;
    if (isLeadership) {
      qTraining = query(
        collection(db, 'training'),
        where('isDemo', '==', false)
      );
    } else if (isTechnician) {
      qTraining = query(
        collection(db, 'training'), 
        where('man_number', '==', profile.man_number),
        where('isDemo', '==', false)
      );
    } else {
      qTraining = query(
        collection(db, 'training'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }
    
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingRecord)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'training'));

    let qPersonnel;
    if (isLeadership) {
      qPersonnel = query(
        collection(db, 'users'),
        where('isDemo', '==', false)
      );
    } else if (isTechnician) {
      qPersonnel = query(
        collection(db, 'users'), 
        where('man_number', '==', profile.man_number),
        where('isDemo', '==', false)
      );
    } else {
      qPersonnel = query(
        collection(db, 'users'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }
    
    const unsubPersonnel = onSnapshot(qPersonnel, (snap) => {
      setPersonnel(snap.docs.map(d => d.data() as UserProfile));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubTraining();
      unsubPersonnel();
    };
  }, [profile, isDemoMode]);

  const getPersonName = (manNumber: string) => {
    const person = personnel.find(p => p.man_number === manNumber);
    return person ? person.name : 'Unknown Personnel';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        
        let mimeType = file.type;
        // Fix for .xlsm which the parser might reject
        if (mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12') {
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        const results = await parseTrainingReport(base64, mimeType);
        
        // Batch upload results
        const newRecords: TrainingRecord[] = [];
        for (const record of results) {
          const dueDate = parseISO(record.due_date);
          const now = new Date();
          const expiringSoon = isBefore(dueDate, addDays(now, 60));
          const expired = isBefore(dueDate, now);
          
          let status: 'current' | 'expiring' | 'expired' = 'current';
          if (expired) status = 'expired';
          else if (expiringSoon) status = 'expiring';

          const trainingData = {
            man_number: record.man_number,
            course_name: record.course_name,
            due_date: record.due_date,
            shopId: profile.shopId,
            amuId: profile.amuId,
            status,
            isDemo: isDemoMode
          };

          await addDoc(collection(db, 'training'), trainingData);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error parsing report. Please ensure the file is a valid Excel document.');
    } finally {
      setIsUploading(false);
    }
  };

  const [notifyModal, setNotifyModal] = useState<{isOpen: boolean, type: 'email'} | null>(null);

  const openNotifyModal = (type: 'email') => {
    setNotifyModal({ isOpen: true, type });
  };

  const filteredTraining = training.filter(record => {
    const personName = getPersonName(record.man_number);
    const matchesSearch = 
      record.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.course_code && record.course_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      record.man_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      personName.toLowerCase().includes(searchQuery.toLowerCase());
      
    let matchesDate = true;
    if (startDate || endDate) {
      const recordDate = new Date(record.due_date);
      if (startDate) matchesDate = matchesDate && recordDate >= new Date(startDate);
      if (endDate) matchesDate = matchesDate && recordDate <= new Date(endDate);
    }
    
    return matchesSearch && matchesDate;
  });

  const stats = {
    current: filteredTraining.filter(t => t.status === 'current').length,
    expiring: filteredTraining.filter(t => t.status === 'expiring').length,
    expired: filteredTraining.filter(t => t.status === 'expired').length,
    total: filteredTraining.length || 1
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">Training Readiness</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Task expiration forecast and qualification oversight</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-surface border border-outline p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 transition-colors", viewMode === 'grid' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface")}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 transition-colors", viewMode === 'list' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
            <div className="flex gap-2">
              <button 
                onClick={() => openNotifyModal('email')}
                className="sleek-button flex items-center gap-2"
                title="Email Affected Users"
              >
                <Send className="w-4 h-4" /> <span className="hidden sm:inline">Email</span>
              </button>
              <button 
                onClick={() => exportTrainingToCSV(filteredTraining, profile.shopId)}
                className="sleek-button bg-surface \!text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export CSV"
              >
                <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button 
                onClick={() => exportTrainingToPDF(filteredTraining, profile.shopId)}
                className="sleek-button bg-surface \!text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export PDF"
              >
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-0 visible-grid bg-surface">
        <div className="flex-1 relative p-4">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Search by course name, man #, or personnel name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-12 w-full !border-none !bg-transparent"
          />
        </div>
        <div className="flex gap-0">
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Due After</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Due Before</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Upload Area */}
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
          <div className="lg:col-span-12">
            <div className="visible-grid bg-surface">
              <label className="p-16 flex flex-col items-center justify-center text-center space-y-6 hover:bg-slate-50 transition-colors group cursor-pointer">
                <input type="file" className="sr-only" onChange={handleFileUpload} disabled={isUploading} />
                <div className="w-20 h-20 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  {isUploading ? <Clock className="w-10 h-10 animate-spin" /> : <UploadCloud className="w-10 h-10" />}
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase text-slate-900">
                    {isUploading ? 'Parsing Report...' : 'Synchronize Training Logs'}
                  </h3>
                  <p className="serif-header text-base max-w-lg mx-auto mt-2 text-slate-600">
                    Upload Excel (.xlsx, .xlsm) or CSV personnel training reports. The system will automatically reconcile and update qualification statuses.
                  </p>
                </div>
                <div className="sleek-button">
                  {isUploading ? 'Processing...' : 'Select Report File'}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Readiness Widgets */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-0 visible-grid bg-surface">
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <span className="tech-label text-emerald-500 font-bold">Fully Qualified</span>
              <span className="font-black text-2xl tracking-tighter text-slate-900">{Math.round((stats.current / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-50 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(stats.current / stats.total) * 100}%` }}></div>
            </div>
            <p className="tech-label text-[10px] opacity-70 text-slate-600">{stats.current} Personnel Current</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <span className="tech-label text-caution-yellow font-bold">Expiring &lt; 60 Days</span>
              <span className="font-black text-2xl tracking-tighter text-slate-900">{Math.round((stats.expiring / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-50 overflow-hidden">
              <div className="h-full bg-caution-yellow transition-all duration-1000" style={{ width: `${(stats.expiring / stats.total) * 100}%` }}></div>
            </div>
            <p className="tech-label text-[10px] opacity-70 text-slate-600">{stats.expiring} Personnel Require Scheduling</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <span className="tech-label text-safety-orange font-bold">Expired / Delinquent</span>
              <span className="font-black text-2xl tracking-tighter text-slate-900">{Math.round((stats.expired / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-50 overflow-hidden">
              <div className="h-full bg-safety-orange transition-all duration-1000" style={{ width: `${(stats.expired / stats.total) * 100}%` }}></div>
            </div>
            <p className="tech-label text-[10px] opacity-70 text-slate-600">{stats.expired} Personnel Non-Mission Capable</p>
          </div>
        </div>

        <div className="lg:col-span-12">
          {viewMode === 'list' ? (
            <div className="visible-grid bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                      <th className="px-8 py-5">Course Name</th>
                      <th className="px-8 py-5">Personnel</th>
                      {profile?.role === 'leadership' && <th className="px-8 py-5">Shop</th>}
                      <th className="px-8 py-5">Due Date</th>
                      <th className="px-8 py-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {filteredTraining.map((record, idx) => (
                      <motion.tr 
                        key={record.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.01 }}
                        className="hover-invert cursor-pointer"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <td className="px-8 py-5">
                          <p className="font-black text-sm tracking-tight uppercase text-slate-900">{record.course_name}</p>
                          {record.course_code && <p className="tech-label text-[10px] mt-1 text-slate-500">CODE: {record.course_code}</p>}
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-black text-[12px] uppercase tracking-tight text-slate-900">{getPersonName(record.man_number)}</p>
                          <p className="tech-label text-[10px] mt-1 text-slate-500">MAN#: {record.man_number}</p>
                        </td>
                        {profile?.role === 'leadership' && (
                          <td className="px-8 py-5">
                            <span className="tech-label">{record.shopId}</span>
                          </td>
                        )}
                        <td className="px-8 py-5">
                          <span className="data-mono text-xs">{record.due_date}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "badge",
                            record.status === 'current' ? "badge-success" : 
                            record.status === 'expiring' ? "badge-warning" : "badge-danger"
                          )}>
                            {record.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 visible-grid bg-white">
              <AnimatePresence>
                {filteredTraining.map((record, idx) => (
                  <motion.div 
                    key={record.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.02 }}
                    className="p-8 flex flex-col justify-between hover:bg-putty/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xl font-black tracking-tighter uppercase group-hover:text-primary transition-colors leading-tight">{record.course_name}</h3>
                          {record.course_code && <p className="tech-label text-[10px] mt-1 text-slate-500 uppercase">{record.course_code}</p>}
                        </div>
                        <span className={cn(
                          "badge",
                          record.status === 'current' ? "badge-success" : 
                          record.status === 'expiring' ? "badge-warning" : "badge-danger"
                        )}>
                          {record.status}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between border-b border-outline pb-2">
                          <span className="tech-label text-[10px]">Personnel</span>
                          <span className="font-black text-[11px] uppercase tracking-tight">
                            {getPersonName(record.man_number)}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-outline pb-2">
                          <span className="tech-label text-[10px]">Due Date</span>
                          <span className="data-mono text-[11px]">{record.due_date}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="tech-label !text-[9px] text-primary group-hover:translate-x-1 transition-transform flex items-center gap-2 mt-8">
                      View Details <ChevronRight className="w-3 h-3" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-xl w-full rounded-none shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-10 border-b border-outline bg-putty/30 flex justify-between items-start">
                <div className="space-y-4">
                  <span className={cn(
                    "badge",
                    selectedRecord.status === 'current' ? "badge-success" : 
                    selectedRecord.status === 'expiring' ? "badge-warning" : "badge-danger"
                  )}>
                    {selectedRecord.status.toUpperCase()}
                  </span>
                  <h3 className="text-3xl font-black tracking-tighter uppercase leading-tight">
                    {selectedRecord.course_name}
                  </h3>
                  {selectedRecord.course_code && (
                    <p className="tech-label text-slate-500 font-black tracking-widest">{selectedRecord.course_code}</p>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 hover:bg-putty transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 space-y-10">
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Assigned Personnel</p>
                    <p className="font-black text-lg uppercase tracking-tight">{getPersonName(selectedRecord.man_number)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Man Number</p>
                    <p className="data-mono text-lg">{selectedRecord.man_number}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Due Date</p>
                    <p className="data-mono text-lg">{selectedRecord.due_date}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Shop Assignment</p>
                    <p className="tech-label text-primary">{selectedRecord.shopId}</p>
                  </div>
                </div>

                <div className="p-6 bg-putty/30 border border-outline space-y-4">
                  <h4 className="tech-label !text-[9px] flex items-center gap-2">
                    <ShieldAlert className="w-3 h-3 text-safety-orange" /> Readiness Assessment
                  </h4>
                  <p className="serif-header text-sm leading-relaxed opacity-70">
                    {selectedRecord.status === 'current' 
                      ? "Personnel is fully qualified for this task. No immediate action required."
                      : selectedRecord.status === 'expiring'
                      ? "Qualification expires within 60 days. Schedule training session immediately to prevent mission impact."
                      : "Personnel is non-mission capable for this task. Immediate grounding or restriction from relevant operations is required."}
                  </p>
                </div>
              </div>

              <div className="p-10 border-t border-outline bg-putty/30">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="sleek-button w-full py-4"
                >
                  Close Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Modal */}
      <AnimatePresence>
        {notifyModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifyModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-surface rounded-3xl shadow-2xl overflow-hidden border border-outline flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-outline bg-surface-container-low flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-on-background">
                    Email Notifications
                  </h3>
                  <p className="text-sm text-on-surface-variant mt-1">Send personalized training alerts</p>
                </div>
                <button 
                  onClick={() => setNotifyModal(null)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-on-surface-variant" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {(() => {
                  const affectedRecords = filteredTraining.filter(t => t.status === 'expired' || t.status === 'expiring');
                  const groupedRecords = affectedRecords.reduce((acc, record) => {
                    if (!acc[record.man_number]) acc[record.man_number] = [];
                    acc[record.man_number].push(record);
                    return acc;
                  }, {} as Record<string, TrainingRecord[]>);

                  const affectedUsers = personnel.filter(p => 
                    groupedRecords[p.man_number] && p.email
                  );

                  if (affectedUsers.length === 0) {
                    return (
                      <div className="text-center py-8 text-on-surface-variant">
                        <p>No users found with missing training and valid contact info.</p>
                      </div>
                    );
                  }

                  return affectedUsers.map(user => {
                    const records = groupedRecords[user.man_number];
                    
                    let msg = `*** 92 AMXS TRAINING ALERT ***\n\n`;
                    msg += `Name: ${user.name}\n`;
                    msg += `ACTION REQUIRED: The following training items are overdue or expiring soon:\n\n`;
                    records.forEach(r => {
                      msg += `• ${r.course_name}\n`;
                      msg += `  DUE: ${r.due_date} | STATUS: ${r.status.toUpperCase()}\n\n`;
                    });
                    msg += `Please complete these items and update the tracker.`;

                    const subject = encodeURIComponent("92 AMXS Training Alert");
                    const body = encodeURIComponent(msg);
                    
                    const link = `mailto:${user.email}?subject=${subject}&body=${body}`;

                    return (
                      <div key={user.uid} className="bg-surface-container-low p-4 rounded-2xl border border-outline flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="flex-1">
                          <h4 className="font-bold text-on-background">{user.name}</h4>
                          <p className="text-xs text-on-surface-variant mb-2">
                            {user.email}
                          </p>
                          <div className="space-y-1">
                            {records.map(r => (
                              <div key={r.id} className="text-xs flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", r.status === 'expired' ? "bg-error" : "bg-warning")}></span>
                                <span className="font-medium text-on-surface">{r.course_name}</span>
                                <span className="text-on-surface-variant">({r.due_date})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <a 
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sleek-button bg-primary text-on-primary whitespace-nowrap"
                        >
                          Send Email
                        </a>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Personnel: React.FC = () => {
  const { user, profile, isDemoMode } = useAuth();
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<UserProfile | null>(null);
  const [personTraining, setPersonTraining] = useState<TrainingRecord[]>([]);
  const [personLogs, setPersonLogs] = useState<MaintenanceLog[]>([]);
  
  const [isEditingPerson, setIsEditingPerson] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const isLeadership = profile.role === 'leadership';
      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (isLeadership) return true;
        return p.amuId === profile.amuId && p.shopId === profile.shopId;
      });
      setPersonnel(filteredMockPersonnel);
      return;
    }

    const isLeadership = profile.role === 'leadership';

    let q;
    if (isLeadership) {
      q = query(
        collection(db, 'users'), 
        where('status', '==', 'active'),
        where('isDemo', '==', false)
      );
    } else {
      q = query(
        collection(db, 'users'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId), 
        where('status', '==', 'active'),
        where('isDemo', '==', false)
      );
    }
    
    const unsub = onSnapshot(q, (snap) => {
      setPersonnel(snap.docs.map(d => d.data() as UserProfile));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return unsub;
  }, [profile, isDemoMode]);

  useEffect(() => {
    if (!selectedPerson || !profile) return;

    if (isDemoMode) {
      const filteredTraining = MOCK_TRAINING.filter(t => t.man_number === selectedPerson.man_number);
      setPersonTraining(filteredTraining);
      
      const filteredLogs = MOCK_LOGS.filter(l => l.man_number === selectedPerson.man_number);
      setPersonLogs(filteredLogs);
      return;
    }

    const qTraining = query(
      collection(db, 'training'),
      where('man_number', '==', selectedPerson.man_number)
    );
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setPersonTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingRecord)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'training'));

    const qLogs = query(
      collection(db, 'logs'),
      where('man_number', '==', selectedPerson.man_number)
    );
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setPersonLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));

    return () => {
      unsubTraining();
      unsubLogs();
    };
  }, [selectedPerson, profile, isDemoMode]);

  const handleEditClick = () => {
    if (selectedPerson) {
      setEditForm(selectedPerson);
      setIsEditingPerson(true);
    }
  };

  const handleUpdatePerson = async () => {
    if (!selectedPerson) return;
    
    if (user?.uid === 'mock-user-123') {
      alert('Demo users cannot modify the live database.');
      setIsEditingPerson(false);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', selectedPerson.uid), {
        ...editForm
      });
      setSelectedPerson({ ...selectedPerson, ...editForm } as UserProfile);
      setIsEditingPerson(false);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleDeletePerson = async () => {
    if (!selectedPerson) return;
    
    if (user?.uid === 'mock-user-123') {
      alert('Demo users cannot modify the live database.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove ${selectedPerson.name}?`)) {
      try {
        await updateDoc(doc(db, 'users', selectedPerson.uid), {
          status: 'inactive'
        });
        setSelectedPerson(null);
        setIsEditingPerson(false);
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">Personnel Roster</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Shop personnel management and qualification oversight</p>
        </div>
        <Users className="text-primary w-12 h-12" />
      </div>

      <div className="visible-grid bg-surface overflow-hidden">
        <div className="p-8 border-b border-outline flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50">
          <h3 className="font-black text-xl tracking-tighter uppercase text-slate-900">Active Duty Roster</h3>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input className="sleek-input pl-12 py-3 text-sm w-full !bg-background" placeholder="Filter roster by name, man#, or role..." />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-putty/50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                <th className="px-8 py-5">Rank / Name</th>
                <th className="px-8 py-5">Man #</th>
                {profile?.role === 'leadership' && <th className="px-8 py-5">Shop</th>}
                <th className="px-8 py-5">Role</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {personnel.map((p, idx) => (
                <motion.tr 
                  key={p.uid} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover-invert cursor-pointer"
                  onClick={() => setSelectedPerson(p)}
                >
                  <td className="px-8 py-5">
                    <p className="font-black text-sm uppercase tracking-tight text-slate-900">{p.rank} {p.name}</p>
                    <p className="tech-label !text-[8px] mt-1 opacity-60">{p.email}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="data-mono text-xs text-slate-700">{p.man_number}</span>
                  </td>
                  {profile?.role === 'leadership' && (
                    <td className="px-8 py-5">
                      <span className="tech-label">{p.shopId}</span>
                    </td>
                  )}
                  <td className="px-8 py-5">
                    <span className={cn(
                      "badge",
                      p.role === 'ncoic' ? "badge-info" : "bg-slate-100 text-slate-500"
                    )}>
                      {p.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      <span className="tech-label !text-[9px]">Active</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedPerson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-3xl w-full rounded-none shadow-2xl overflow-hidden border border-outline flex flex-col max-h-[90vh]"
            >
              <div className="p-10 border-b border-outline bg-putty/30 flex justify-between items-start">
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                    <Users className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">{selectedPerson.name}</h3>
                    <p className="tech-label mt-3 opacity-60">
                      {selectedPerson.rank} • {selectedPerson.role.toUpperCase()} • MAN#: {selectedPerson.man_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {(profile?.role === 'leadership' || profile?.role === 'ncoic') && (
                    <>
                      <button 
                        onClick={handleEditClick}
                        className="p-3 hover:bg-putty transition-colors text-primary border border-outline"
                        title="Edit User"
                      >
                        <Wrench className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={handleDeletePerson}
                        className="p-3 hover:bg-putty transition-colors text-safety-orange border border-outline"
                        title="Delete User"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedPerson(null);
                      setIsEditingPerson(false);
                    }}
                    className="p-3 hover:bg-putty transition-colors border border-outline"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                {isEditingPerson ? (
                  <section className="space-y-8">
                    <h4 className="tech-label text-primary">Edit Personnel Profile</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="tech-label !text-[9px]">Full Name</label>
                        <input 
                          type="text" 
                          value={editForm.name || ''} 
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="sleek-input w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="tech-label !text-[9px]">Email Address</label>
                        <input 
                          type="email" 
                          value={editForm.email || ''} 
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          className="sleek-input w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="tech-label !text-[9px]">Contact Phone</label>
                        <input 
                          type="text" 
                          value={editForm.phone || ''} 
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="sleek-input w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="tech-label !text-[9px]">Man Number</label>
                        <input 
                          type="text" 
                          value={editForm.man_number || ''} 
                          onChange={(e) => setEditForm({...editForm, man_number: e.target.value})}
                          className="sleek-input w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="tech-label !text-[9px]">AMU Assignment</label>
                        <select 
                          value={editForm.amuId || ''} 
                          onChange={(e) => setEditForm({...editForm, amuId: e.target.value as AMUType})}
                          className="sleek-input w-full"
                        >
                          <option value="">Select AMU...</option>
                          {AMUS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="tech-label !text-[9px]">Shop Assignment</label>
                        <select 
                          value={editForm.shopId || ''} 
                          onChange={(e) => setEditForm({...editForm, shopId: e.target.value as ShopType})}
                          className="sleek-input w-full"
                        >
                          <option value="">Select Shop...</option>
                          {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="tech-label !text-[9px]">System Role</label>
                        <select 
                          value={editForm.role || 'technician'} 
                          onChange={(e) => setEditForm({...editForm, role: e.target.value as any})}
                          className="sleek-input w-full"
                        >
                          <option value="technician">Technician</option>
                          <option value="ncoic">NCOIC</option>
                          <option value="leadership">Leadership</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-6">
                      <button 
                        onClick={() => setIsEditingPerson(false)}
                        className="sleek-button bg-white !text-on-surface border border-outline hover:bg-putty"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleUpdatePerson}
                        className="sleek-button px-12"
                      >
                        Save Profile
                      </button>
                    </div>
                  </section>
                ) : (
                  <>
                    {/* Training History */}
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        <h4 className="tech-label text-primary">Training History</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-0 visible-grid">
                        {personTraining.length > 0 ? personTraining.map(t => (
                          <div key={t.id} className="p-6 flex justify-between items-center hover:bg-putty/30 transition-colors">
                            <div>
                              <p className="font-black text-xs uppercase tracking-tight">{t.course_name}</p>
                              <p className="tech-label !text-[8px] mt-1 opacity-60">Due Date: <span className="data-mono">{t.due_date}</span></p>
                            </div>
                            <span className={cn(
                              "badge",
                              t.status === 'current' ? "badge-success" : 
                              t.status === 'expiring' ? "badge-warning" : "badge-danger"
                            )}>
                              {t.status}
                            </span>
                          </div>
                        )) : (
                          <p className="tech-label !text-[9px] opacity-40 p-10 text-center uppercase tracking-widest">No training records found.</p>
                        )}
                      </div>
                    </section>

                    {/* Recent Maintenance */}
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Wrench className="w-5 h-5 text-primary" />
                        <h4 className="tech-label text-primary">Recent Maintenance Operations</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-0 visible-grid">
                        {personLogs.length > 0 ? personLogs.map(l => (
                          <div key={l.id} className="p-6 hover:bg-putty/30 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                              <p className="font-black text-sm uppercase tracking-tighter">{l.tail_number}</p>
                              <p className="data-mono text-[9px] opacity-60">{format(l.timestamp.toDate(), 'yyyy.MM.dd')}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[11px] leading-relaxed"><span className="tech-label !text-[8px] text-safety-orange mr-2">DISC:</span> {l.discrepancy}</p>
                              <p className="text-[11px] leading-relaxed opacity-70"><span className="tech-label !text-[8px] text-primary mr-2">REPAIR:</span> {l.repair}</p>
                            </div>
                          </div>
                        )) : (
                          <p className="tech-label !text-[9px] opacity-40 p-10 text-center uppercase tracking-widest">No maintenance logs found.</p>
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>

              <div className="p-10 border-t border-outline bg-putty/30">
                <button 
                  onClick={() => {
                    setSelectedPerson(null);
                    setIsEditingPerson(false);
                  }}
                  className="sleek-button w-full py-4"
                >
                  Close Personnel Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Support: React.FC = () => {
  const { profile, updateUserPassword } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [passData, setPassData] = useState({ new: '', confirm: '' });
  const [passStatus, setPassStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) {
      setPassStatus({ type: 'error', msg: 'Passwords do not match' });
      return;
    }
    setIsUpdating(true);
    setPassStatus(null);
    try {
      await updateUserPassword(passData.new);
      setPassStatus({ type: 'success', msg: 'Password updated successfully' });
      setPassData({ new: '', confirm: '' });
    } catch (err: any) {
      setPassStatus({ type: 'error', msg: err.message || 'Update failed' });
    } finally {
      setIsUpdating(false);
    }
  };

  const faqs = [
    {
      q: "How do I request access to a different shop?",
      a: "Contact your NCOIC or a Leadership member. They can edit your profile from the Personnel tab and reassign your shop."
    },
    {
      q: "My training records aren't showing up correctly.",
      a: "Training records are updated via the 'Upload Training Report' feature in the Training Tracker. Ensure your NCOIC has uploaded the latest report from the training system."
    },
    {
      q: "Can I edit a maintenance log after submitting it?",
      a: "Currently, maintenance logs are permanent once submitted to ensure data integrity. If a mistake was made, please submit a new entry with the correct information and note the correction."
    },
    {
      q: "How do I gain administrative access?",
      a: "Administrative access is restricted to authorized personnel only. If you require admin privileges, contact the System Administrator directly with your justification."
    },
    {
      q: "What should I do if the system is slow or unresponsive?",
      a: "First, refresh your browser. If the issue persists, check your network connection. If it still fails, report the issue to the Technical Support contact listed on this page."
    },
    {
      q: "How are maintenance discrepancies tracked?",
      a: "Discrepancies are tracked in real-time via the Maintenance Logs page. Ensure all entries are accurate and complete to maintain data integrity across shifts."
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-16 py-12">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
          <HelpCircle className="w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter uppercase text-slate-900">Support & Documentation</h1>
        <p className="serif-header text-xl max-w-2xl mx-auto text-slate-600">
          Operational guidance and technical support for the 92nd AMXS Maintenance & Training Control System.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 visible-grid bg-surface">
        <div className="p-10 space-y-6 border-r border-outline">
          <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3 text-slate-900">
            <Users className="w-6 h-6 text-primary" /> Technical Oversight
          </h3>
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 border border-outline">
              <p className="tech-label mb-2">System Administrator & Developer</p>
              <p className="font-black text-sm uppercase tracking-tight text-slate-900">TSgt Steven Koehl</p>
              <p className="data-mono text-xs mt-1 opacity-60">Steven.Koehl.1@us.af.mil</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-3xl font-black tracking-tighter uppercase text-center">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 gap-0 visible-grid bg-surface">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-outline last:border-b-0">
              <button 
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full p-8 flex justify-between items-center hover:bg-putty/30 transition-colors text-left"
              >
                <span className="font-black text-sm uppercase tracking-tight">{faq.q}</span>
                <ChevronRight className={cn("w-5 h-5 transition-transform", openFaq === i ? "rotate-90" : "")} />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-8 pt-0 serif-header text-base leading-relaxed opacity-70">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Account Management Section */}
      <div className="space-y-8">
        <h2 className="text-3xl font-black tracking-tighter uppercase text-center">Account Security</h2>
        <div className="visible-grid bg-surface p-10 space-y-8 max-w-2xl mx-auto shadow-lg">
          <div className="space-y-4">
            <h3 className="tech-label text-primary">System Access Credentials</h3>
            <p className="serif-header text-sm text-slate-600">You can update your operational password below. Ensure it meets military strength requirements.</p>
          </div>
          
          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            <div className="space-y-2">
              <label className="tech-label">New Access Password</label>
              <input 
                type="password"
                required
                minLength={8}
                className="sleek-input w-full"
                placeholder="••••••••"
                value={passData.new}
                onChange={e => setPassData({ ...passData, new: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="tech-label">Confirm New Password</label>
              <input 
                type="password"
                required
                minLength={8}
                className="sleek-input w-full"
                placeholder="••••••••"
                value={passData.confirm}
                onChange={e => setPassData({ ...passData, confirm: e.target.value })}
              />
            </div>

            {passStatus && (
              <div className={cn(
                "p-4 border flex items-center gap-3 text-[10px] font-black uppercase tracking-tight",
                passStatus.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-safety-orange/10 border-safety-orange/20 text-safety-orange"
              )}>
                {passStatus.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                {passStatus.msg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isUpdating}
              className="sleek-button w-full py-4 text-xs font-black"
            >
              {isUpdating ? 'Updating Credentials...' : 'Update Credentials'}
            </button>
          </form>
        </div>
      </div>

      {/* Removed Guided Tour Section */}
    </div>
  );
};

// --- AI Assistant ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MaintenanceAssistant: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [dataSnapshot, setDataSnapshot] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  useEffect(() => {
    if (!profile) return;
    
    // Fetch a snapshot of data to provide local context to the bot
    const fetchSnapshot = async () => {
      try {
        const logsRef = collection(db, 'logs');
        const trainingRef = collection(db, 'training');
        
        let qLogs, qTraining;
        if (profile.role === 'leadership') {
          qLogs = query(logsRef, where('isDemo', '==', isDemoMode), limit(50));
          qTraining = query(trainingRef, where('isDemo', '==', isDemoMode), limit(50));
        } else {
          qLogs = query(logsRef, where('amuId', '==', profile.amuId), where('shopId', '==', profile.shopId), where('isDemo', '==', isDemoMode), limit(50));
          qTraining = query(trainingRef, where('amuId', '==', profile.amuId), where('shopId', '==', profile.shopId), where('isDemo', '==', isDemoMode), limit(50));
        }

        const [logSnap, trainSnap] = await Promise.all([getDocs(qLogs), getDocs(qTraining)]);
        
        setDataSnapshot({
          logs: logSnap.docs.map(d => {
            const data = d.data() as MaintenanceLog;
            return { 
              tail: data.tail_number, 
              disc: data.discrepancy, 
              tech: data.technician_name,
              shift: data.shift
            };
          }),
          training: trainSnap.docs.map(d => {
            const data = d.data() as TrainingRecord;
            return {
              course: data.course_name,
              code: data.course_code,
              status: data.status,
              due: data.due_date
            };
          }),
          stats: {
            shop: profile.shopId,
            amu: profile.amuId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (e) {
        console.error("AI Context error:", e);
      }
    };

    fetchSnapshot();
  }, [profile, isDemoMode, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsThinking(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMsg,
        config: {
          systemInstruction: `You are the 92nd AMXS Maintenance Assistant. Your mission is to assist 92nd Air Refueling Squadron maintainers with technical data analysis and readiness reporting.
          CONSTRAINTS: 
          1. ONLY answer questions related to the provided maintenance logs and training records.
          2. Decline any off-topic requests (jokes, general trivia, unrelated news).
          3. Use the provided DATA SNAPSHOT to identify trends, training gaps, or recurring tail number issues.
          4. Maintain a professional, mission-focused military tone. 
          5. Keep responses concise and scannable.
          
          DATA SNAPSHOT:
          ${JSON.stringify(dataSnapshot)}`,
          temperature: 0.1,
          topP: 0.95,
        }
      });

      if (response.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
      } else {
        throw new Error("Empty response from intelligence engine");
      }
    } catch (err) {
      console.error("AI Assistant Error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "SYSTEM ERROR: Operational data analysis interrupted. Communication link unstable." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[1000]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-0 w-[400px] h-[600px] bg-white visible-grid shadow-2xl overflow-hidden flex flex-col border border-outline"
          >
            {/* Header */}
            <div className="p-6 bg-sidebar border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-none border border-primary/30">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-white">Ops Intelligence</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[8px] font-mono text-white/40 uppercase">System Online // 92 AMXS</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div 
              ref={scrollRef}
              className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
                  <Sparkles className="w-8 h-8 text-primary/30" />
                  <div>
                    <p className="tech-label text-slate-400">Analysis Engine Ready</p>
                    <p className="serif-header text-sm text-slate-500 mt-2">
                      Ask about maintenance trends, tail number history, or shop training readiness.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full mt-4">
                    {["Identify recurring tail number issues", "Check training gaps for next 30 days"].map(q => (
                      <button 
                        key={q}
                        onClick={() => { setInput(q); }}
                        className="text-left p-3 text-[10px] font-black uppercase tracking-tight bg-white border border-outline hover:border-primary/40 transition-colors"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn(
                  "flex flex-col max-w-[85%]",
                  m.role === 'user' ? "ml-auto items-end" : "items-start"
                )}>
                  <span className="tech-label !text-[8px] mb-1 opacity-40 uppercase">
                    {m.role === 'user' ? 'Operator' : 'AMXS-AI'}
                  </span>
                  <div className={cn(
                    "p-4 text-sm leading-relaxed",
                    m.role === 'user' 
                      ? "bg-primary text-white font-medium shadow-lg" 
                      : "bg-white border border-outline text-slate-900 serif-header shadow-sm"
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex flex-col items-start max-w-[85%]">
                  <span className="tech-label !text-[8px] mb-1 opacity-40 uppercase">AMXS-AI</span>
                  <div className="p-4 bg-white border border-outline text-slate-900 flex items-center gap-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-primary animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                    <span className="tech-label !text-[9px] text-slate-400 animate-pulse uppercase">Processing Intelligence...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-6 bg-white border-t border-outline">
              <div className="flex gap-3">
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Analyze logs via natural language..."
                  className="flex-1 sleek-input text-xs bg-slate-50"
                  disabled={isThinking}
                />
                <button 
                  disabled={isThinking || !input.trim()}
                  className="p-3 bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-none flex items-center justify-center shadow-2xl transition-all border-2",
          isOpen 
            ? "bg-white border-primary text-primary" 
            : "bg-primary border-primary text-white"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
      </motion.button>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium text-sm animate-pulse">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;
  if (!profile) return <Setup />;
  if (profile.status === 'pending') return <PendingApproval />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/maintenance" element={<MaintenanceLogs />} />
        <Route path="/difm" element={<DIFMLogs />} />
        <Route path="/training" element={<TrainingTracker />} />
        <Route path="/personnel" element={<Personnel />} />
        <Route path="/support" element={<Support />} />
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && <Route path="/onboarding" element={<Onboarding />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <MaintenanceAssistant />
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
