import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
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
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  orderBy
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
  Menu,
  X,
  Send,
  Clock,
  FileDown,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  UserPlus,
  Mail,
  Lock,
  List,
  Grid
} from 'lucide-react';
import { format, addDays, isBefore, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { cn } from './lib/utils';
import { UserProfile, MaintenanceLog, TrainingRecord, UserRole } from './types';
import { parseTrainingReport } from './services/parserService';
import { 
  exportLogsToCSV, 
  exportLogsToPDF, 
  exportTrainingToCSV, 
  exportTrainingToPDF 
} from './lib/exportUtils';

// --- Constants & Mock Data ---

const SHOPS = ['AVIONICS', 'CREW_CHIEFS', 'JETS', 'RADAR'] as const;
type ShopType = typeof SHOPS[number];

const MOCK_LOGS: MaintenanceLog[] = [
  // AVIONICS
  {
    id: 'mock-log-1',
    tail_number: 'AF-92-0451',
    discrepancy: 'Radar altimeter intermittent failure during low-level flight.',
    repair: 'Replaced LRU-3 and verified signal integrity.',
    shopId: 'AVIONICS',
    technician_name: 'DOE, J',
    man_number: '12345',
    timestamp: { toDate: () => new Date() } as any,
    isRedBall: true
  },
  {
    id: 'mock-log-2',
    tail_number: 'AF-94-0122',
    discrepancy: 'Navigation display flickering in cold weather.',
    repair: 'Reseated connections and updated firmware.',
    shopId: 'AVIONICS',
    technician_name: 'SMITH, A',
    man_number: '54321',
    timestamp: { toDate: () => new Date(Date.now() - 86400000) } as any
  },
  // CREW CHIEFS
  {
    id: 'mock-log-3',
    tail_number: 'AF-90-0882',
    discrepancy: 'Left main tire showing excessive wear.',
    repair: 'Replaced tire and inspected brake assembly.',
    shopId: 'CREW_CHIEFS',
    technician_name: 'MILLER, R',
    man_number: '22222',
    timestamp: { toDate: () => new Date() } as any,
    isRedBall: false
  },
  // JETS
  {
    id: 'mock-log-4',
    tail_number: 'AF-88-0115',
    discrepancy: 'Engine #2 high oil consumption reported.',
    repair: 'Inspected seals, found leak in scavenge pump, replaced pump.',
    shopId: 'JETS',
    technician_name: 'BROWN, T',
    man_number: '33333',
    timestamp: { toDate: () => new Date() } as any,
    isRedBall: true
  }
];

const MOCK_PERSONNEL: UserProfile[] = [
  // AVIONICS
  { uid: 'mock-user-123', name: 'PREVIEW USER', man_number: '99999', shopId: 'AVIONICS', role: 'ncoic', email: 'dev.preview@92amxs.af.mil', status: 'active' },
  { uid: 'mock-user-2', name: 'DOE, J', man_number: '12345', shopId: 'AVIONICS', role: 'technician', email: 'doe.j@92amxs.af.mil', status: 'active' },
  { uid: 'mock-user-3', name: 'SMITH, A', man_number: '54321', shopId: 'AVIONICS', role: 'technician', email: 'smith.a@92amxs.af.mil', status: 'active' },
  // CREW CHIEFS
  { uid: 'mock-user-4', name: 'MILLER, R', man_number: '22222', shopId: 'CREW_CHIEFS', role: 'technician', email: 'miller.r@92amxs.af.mil', status: 'active' },
  { uid: 'mock-user-5', name: 'JOHNSON, K', man_number: '22223', shopId: 'CREW_CHIEFS', role: 'ncoic', email: 'johnson.k@92amxs.af.mil', status: 'active' },
  // JETS
  { uid: 'mock-user-6', name: 'BROWN, T', man_number: '33333', shopId: 'JETS', role: 'technician', email: 'brown.t@92amxs.af.mil', status: 'active' },
  { uid: 'mock-user-7', name: 'DAVIS, L', man_number: '33334', shopId: 'JETS', role: 'ncoic', email: 'davis.l@92amxs.af.mil', status: 'active' }
];

const MOCK_TRAINING: TrainingRecord[] = [
  // AVIONICS
  { id: 't1', man_number: '99999', course_name: 'Advanced Avionics Systems', due_date: '2026-12-01', shopId: 'AVIONICS', status: 'current' },
  { id: 't2', man_number: '12345', course_name: 'Flight Safety Refresher', due_date: format(addDays(new Date(), 15), 'yyyy-MM-dd'), shopId: 'AVIONICS', status: 'expiring' },
  { id: 't3', man_number: '54321', course_name: 'Classified Comms Handling', due_date: '2024-01-10', shopId: 'AVIONICS', status: 'expired' },
  // CREW CHIEFS
  { id: 't4', man_number: '22222', course_name: 'Tire & Wheel Maintenance', due_date: '2026-05-20', shopId: 'CREW_CHIEFS', status: 'current' },
  // JETS
  { id: 't5', man_number: '33333', course_name: 'F108 Engine Overhaul', due_date: '2026-08-15', shopId: 'JETS', status: 'current' }
];

// --- Contexts ---

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  signUpEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  bypassLogin: (role?: UserRole) => void;
  setShop: (shop: ShopType) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email sign in error:', error);
      throw error;
    }
  };

  const signUpEmail = async (email: string, pass: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email sign up error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const bypassLogin = (role: UserRole = 'ncoic') => {
    const mockUser = {
      uid: 'mock-user-123',
      email: 'dev.preview@92amxs.af.mil',
      displayName: 'PREVIEW USER',
    } as User;
    
    const mockProfile: UserProfile = {
      uid: 'mock-user-123',
      name: 'PREVIEW USER',
      man_number: '99999',
      shopId: 'AVIONICS',
      role: role,
      email: 'dev.preview@92amxs.af.mil',
      phone: '555-0123',
      status: 'active'
    };
    
    setUser(mockUser);
    setProfile(mockProfile);
    setLoading(false);
  };

  const setShop = (shop: ShopType) => {
    if (profile && user?.uid === 'mock-user-123') {
      setProfile({ ...profile, shopId: shop });
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
      logout, 
      refreshProfile, 
      bypassLogin, 
      setShop 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, logout, setShop } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Maintenance Log', path: '/maintenance', icon: Wrench },
    { name: 'Training Tracker', path: '/training', icon: BarChart3 },
    { name: 'Personnel', path: '/personnel', icon: Users },
  ];

  if (profile?.role === 'ncoic' || profile?.role === 'leadership') {
    navItems.push({ name: 'Onboarding', path: '/onboarding', icon: UserPlus });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[240px] bg-sidebar text-white transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="logo flex items-center gap-3 px-6 py-8">
          <div className="logo-box w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white">
            92
          </div>
          <div className="font-bold text-lg tracking-tight">AMXS Log</div>
        </div>

        <nav className="flex-grow">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm transition-all",
                location.pathname === item.path 
                  ? "bg-white/10 text-white border-r-4 border-primary" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-6 text-xs text-slate-500 border-t border-white/5">
          {user?.uid === 'mock-user-123' && (
            <div className="mb-6 relative">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold">Preview Shop</p>
              <button 
                onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-200 hover:bg-white/10 transition-colors"
              >
                <span className="font-semibold">{profile?.shopId}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isShopDropdownOpen && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {isShopDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50"
                  >
                    {SHOPS.map(shop => (
                      <button
                        key={shop}
                        onClick={() => {
                          setShop(shop);
                          setIsShopDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors",
                          profile?.shopId === shop ? "text-primary font-bold" : "text-slate-300"
                        )}
                      >
                        {shop}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
              <Users className="text-slate-400 w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-slate-200 truncate">{profile?.name}</p>
              <p className="text-[10px] uppercase tracking-wider">Shop: {profile?.shopId}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 hover:text-error transition-colors"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="flex justify-between items-start p-8">
          <div>
            <h1 className="text-2xl font-bold text-on-background">
              {navItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
            </h1>
            <p className="text-on-surface-variant text-sm">92nd Aircraft Maintenance Squadron • Fairchild AFB</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="font-semibold text-on-background">{profile?.name}</div>
            <div className="text-xs text-on-surface-variant uppercase tracking-wider">{profile?.role} • Shop ID: {profile?.shopId}</div>
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
  const { signIn, signInEmail, signUpEmail, bypassLogin } = useAuth();
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) {
        await signUpEmail(email, password);
      } else {
        await signInEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Terminal className="text-white w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold text-on-background tracking-tight">92ND AMXS</h1>
          <p className="text-on-surface-variant font-medium text-sm">Avionics Turnover & Training Tracker</p>
        </div>
        
        <div className="sleek-card space-y-6">
          <p className="text-sm text-on-surface leading-relaxed">
            Access to the 92nd AMXS Maintenance & Training system is restricted to authorized personnel only.
          </p>

          {!isEmailMode ? (
            <div className="space-y-3">
              <button 
                onClick={signIn}
                className="sleek-button w-full flex items-center justify-center gap-3 py-3"
              >
                Authenticate with Google
              </button>
              <button 
                onClick={() => setIsEmailMode(true)}
                className="w-full py-3 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-widest"
              >
                Use Email & Password
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="sleek-input pl-10 w-full" 
                    placeholder="name@af.mil" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="sleek-input pl-10 w-full" 
                    placeholder="••••••••" 
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-center gap-3 text-error text-xs font-medium">
                  <ShieldAlert className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button type="submit" className="sleek-button w-full py-3">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>

              <div className="flex justify-between items-center px-1">
                <button 
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                >
                  {isSignUp ? 'Already have an account?' : 'Need an account?'}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsEmailMode(false)}
                  className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:underline"
                >
                  Back to Google
                </button>
              </div>
            </form>
          )}

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-background px-2 text-on-surface-variant font-bold">Or</span></div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Demo Roles</p>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => bypassLogin('technician')}
                className="py-2 text-[10px] font-bold text-accent hover:bg-accent/5 border border-accent/20 rounded-lg transition-all uppercase tracking-wider"
              >
                Tech
              </button>
              <button 
                onClick={() => bypassLogin('ncoic')}
                className="py-2 text-[10px] font-bold text-accent hover:bg-accent/5 border border-accent/20 rounded-lg transition-all uppercase tracking-wider"
              >
                NCOIC
              </button>
              <button 
                onClick={() => bypassLogin('leadership')}
                className="py-2 text-[10px] font-bold text-accent hover:bg-accent/5 border border-accent/20 rounded-lg transition-all uppercase tracking-wider"
              >
                Leadership
              </button>
            </div>
          </div>
        </div>
        
        <div className="opacity-40 flex flex-col items-center gap-1">
          <ShieldAlert className="w-6 h-6 text-error" />
          <p className="text-[10px] font-bold tracking-widest uppercase">Unclassified // FOUO</p>
          <p className="text-[10px] font-medium">SECURED DATA LINK ACTIVE</p>
        </div>
      </div>
    </div>
  );
};

const Setup: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: formData.name,
        phone: formData.phone,
        man_number: 'PENDING',
        shopId: 'PENDING',
        role: 'pending',
        status: 'pending',
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      await refreshProfile();
    } catch (error) {
      console.error('Setup error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-on-background tracking-tight">Access Request</h2>
          <p className="text-on-surface-variant font-medium text-sm mt-2">Submit your details for NCOIC approval</p>
        </div>

        <form onSubmit={handleSubmit} className="sleek-card space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Full Name (Surname, Initial)</label>
              <input 
                required
                className="sleek-input"
                placeholder="DOE, J"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Phone Number (Optional)</label>
              <input 
                className="sleek-input"
                placeholder="555-0123"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="sleek-button w-full py-4 bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Request System Access'}
          </button>
        </form>
      </div>
    </div>
  );
};

const PendingApproval: React.FC = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-surface-container-high rounded-2xl flex items-center justify-center">
            <Clock className="text-primary w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-on-background tracking-tight">Access Pending</h1>
          <p className="text-on-surface-variant font-medium">Your account is currently awaiting approval from an NCOIC.</p>
        </div>
        
        <div className="sleek-card space-y-4">
          <p className="text-sm text-on-surface leading-relaxed">
            Once an administrator assigns your shop and man number, you will be granted full access to the system.
          </p>
          <button 
            onClick={logout}
            className="sleek-button w-full py-3"
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
    man_number: '',
    shopId: '',
    role: 'technician' as UserRole
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;

    if (profile.uid === 'mock-user-123') {
      setPendingUsers([
        { 
          uid: 'mock-pending-1', 
          name: 'DOE, Jane', 
          email: 'doe.jane@92amxs.af.mil', 
          role: 'pending', 
          status: 'pending', 
          man_number: '',
          shopId: '',
          createdAt: { toDate: () => new Date() } 
        } as any
      ]);
      return;
    }

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
        man_number: '',
        shopId: profile?.shopId || '',
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
        status: 'active'
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-on-background">Pending Approvals</h2>
          <p className="text-sm text-on-surface-variant">Review and onboard new personnel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingUsers.length > 0 ? pendingUsers.map(u => (
          <div key={u.uid} className="sleek-card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-on-background">{u.name}</h3>
                <p className="text-xs text-on-surface-variant">{u.email}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Requested: {u.createdAt?.toDate() ? format(u.createdAt.toDate(), 'MMM dd, HH:mm') : 'N/A'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedUser(u)}
                className="sleek-button bg-primary text-white px-6"
              >
                Approve & Assign
              </button>
              <button 
                onClick={() => handleReject(u.uid)}
                className="sleek-button border-error text-error hover:bg-error/5"
              >
                Reject
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-outline border-dashed">
            <Clock className="w-12 h-12 text-on-surface-variant/20 mx-auto mb-4" />
            <p className="text-on-surface-variant font-medium">No pending access requests</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-high w-full max-w-lg rounded-[2rem] shadow-2xl border border-outline overflow-hidden"
            >
              <div className="p-8 border-b border-outline flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-on-background">Onboard Personnel</h3>
                  <p className="text-sm text-on-surface-variant">Assign shop and credentials for {selectedUser.name}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-surface-container-highest rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleApprove} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Full Name</label>
                    <input 
                      required
                      className="sleek-input"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Man #</label>
                      <input 
                        required
                        className="sleek-input"
                        placeholder="00000"
                        value={formData.man_number}
                        onChange={e => setFormData({...formData, man_number: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Shop</label>
                      <select 
                        required
                        className="sleek-input"
                        value={formData.shopId}
                        onChange={e => setFormData({...formData, shopId: e.target.value})}
                      >
                        <option value="">Select Shop</option>
                        {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">System Role</label>
                    <div className="flex gap-4">
                      {['technician', 'ncoic', 'leadership'].map((r) => (
                        <label key={r} className="flex-1 cursor-pointer">
                          <input 
                            type="radio" 
                            className="sr-only peer" 
                            name="role" 
                            value={r}
                            checked={formData.role === r}
                            onChange={() => setFormData({...formData, role: r as UserRole})}
                          />
                          <div className="bg-surface-container-low text-center py-3 rounded-xl border border-outline peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition-all font-bold text-xs uppercase tracking-wider">
                            {r}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="sleek-button flex-1 py-3"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="sleek-button flex-1 py-3 bg-primary text-white font-bold"
                  >
                    {loading ? 'Processing...' : 'Complete Onboarding'}
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
  const { profile } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);

  useEffect(() => {
    if (!profile) return;

    const isLeadership = profile.role === 'leadership';

    if (profile.uid === 'mock-user-123') {
      setLogs(isLeadership ? MOCK_LOGS : MOCK_LOGS.filter(l => l.shopId === profile.shopId));
      setPersonnel(isLeadership ? MOCK_PERSONNEL : MOCK_PERSONNEL.filter(p => p.shopId === profile.shopId));
      setTraining(isLeadership ? MOCK_TRAINING : MOCK_TRAINING.filter(t => t.shopId === profile.shopId));
      return;
    }

    const qLogs = isLeadership 
      ? query(collection(db, 'logs'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'logs'), where('shopId', '==', profile.shopId), orderBy('timestamp', 'desc'));
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    });

    const qPersonnel = isLeadership
      ? query(collection(db, 'users'))
      : query(collection(db, 'users'), where('shopId', '==', profile.shopId));
    
    const unsubPersonnel = onSnapshot(qPersonnel, (snap) => {
      setPersonnel(snap.docs.map(d => d.data() as UserProfile));
    });

    const qTraining = isLeadership
      ? query(collection(db, 'training'))
      : query(collection(db, 'training'), where('shopId', '==', profile.shopId));
    
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setTraining(snap.docs.map(d => d.data() as TrainingRecord));
    });

    return () => {
      unsubLogs();
      unsubPersonnel();
      unsubTraining();
    };
  }, [profile]);

  const urgentLogs = logs.filter(l => l.isRedBall).length;
  const readiness = training.length > 0 
    ? Math.round((training.filter(t => t.status === 'current').length / training.length) * 100)
    : 100;

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="sleek-card">
          <div className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-2">Active Log Entries</div>
          <div className="text-3xl font-bold text-primary">{logs.length}</div>
        </div>
        <div className="sleek-card">
          <div className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-2">Training Overdue</div>
          <div className="text-3xl font-bold text-error">{training.filter(t => t.status === 'expired').length}</div>
        </div>
        <div className="sleek-card">
          <div className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-2">Due &lt; 60 Days</div>
          <div className="text-3xl font-bold text-tertiary">{training.filter(t => t.status === 'expiring').length}</div>
        </div>
        <div className="sleek-card">
          <div className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-2">Personnel Readiness</div>
          <div className="text-3xl font-bold text-emerald-500">{readiness}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Personnel Roster */}
        <div className="lg:col-span-12">
          <div className="sleek-card !p-0 overflow-hidden">
            <div className="p-6 border-b border-outline flex justify-between items-center bg-surface">
              <h3 className="font-bold text-lg text-on-background tracking-tight">Personnel Roster</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input className="sleek-input pl-10 py-2 text-xs w-64" placeholder="Filter Roster..." />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high text-[11px] font-bold text-on-surface-variant tracking-wider uppercase">
                    <th className="px-6 py-4">Name / Rank</th>
                    <th className="px-6 py-4">Man #</th>
                    {profile?.role === 'leadership' && <th className="px-6 py-4">Shop</th>}
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {personnel.map((p) => (
                    <tr key={p.uid} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-on-background">{p.name}</p>
                        <p className="text-[11px] text-on-surface-variant">{p.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{p.man_number}</td>
                      {profile?.role === 'leadership' && <td className="px-6 py-4 text-sm text-on-surface-variant font-bold">{p.shopId}</td>}
                      <td className="px-6 py-4">
                        <span className={cn(
                          "badge",
                          p.role === 'ncoic' ? "badge-info" : "bg-slate-100 text-slate-600"
                        )}>
                          {p.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-xs font-medium text-on-surface-variant">Active</span>
                        </div>
                      </td>
                    </tr>
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
  const { profile } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tail_number: '',
    jcn: '',
    discrepancy: '',
    repair: '',
    doc_number: '',
    personnelInput: '',
    isRedBall: false
  });
  const [loading, setLoading] = useState(false);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!profile) return;

    const isLeadership = profile.role === 'leadership';

    if (profile.uid === 'mock-user-123') {
      setLogs(isLeadership ? MOCK_LOGS : MOCK_LOGS.filter(l => l.shopId === profile.shopId));
      return;
    }

    const q = isLeadership
      ? query(collection(db, 'logs'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'logs'), where('shopId', '==', profile.shopId), orderBy('timestamp', 'desc'));
    
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    });
    return unsub;
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    
    const personnelArray = formData.personnelInput.split(',').map(p => p.trim()).filter(p => p);
    
    try {
      if (profile.uid === 'mock-user-123') {
        const newLog: MaintenanceLog = {
          id: `mock-${Date.now()}`,
          tail_number: formData.tail_number,
          jcn: formData.jcn,
          discrepancy: formData.discrepancy,
          repair: formData.repair,
          doc_number: formData.doc_number,
          isRedBall: formData.isRedBall,
          shopId: profile.shopId,
          technician_name: profile.name,
          man_number: profile.man_number,
          personnel: personnelArray,
          timestamp: { toDate: () => new Date() } as any
        };
        setLogs([newLog, ...logs]);
        setIsModalOpen(false);
        setFormData({ tail_number: '', jcn: '', discrepancy: '', repair: '', doc_number: '', personnelInput: '', isRedBall: false });
        return;
      }

      const newLog: MaintenanceLog = {
        tail_number: formData.tail_number,
        jcn: formData.jcn,
        discrepancy: formData.discrepancy,
        repair: formData.repair,
        doc_number: formData.doc_number,
        isRedBall: formData.isRedBall,
        shopId: profile.shopId,
        technician_name: profile.name,
        man_number: profile.man_number,
        personnel: personnelArray,
        timestamp: serverTimestamp()
      };
      await addDoc(collection(db, 'logs'), newLog);
      setIsModalOpen(false);
      setFormData({ tail_number: '', jcn: '', discrepancy: '', repair: '', doc_number: '', personnelInput: '', isRedBall: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-background">Maintenance Logs</h2>
          <p className="text-on-surface-variant font-medium text-sm mt-1">Real-time Turnover & Discrepancy Tracking</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-surface-container-high rounded-xl p-1 border border-outline">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 rounded-lg transition-colors", viewMode === 'grid' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface")}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-colors", viewMode === 'list' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {profile?.role === 'ncoic' && (
            <div className="flex gap-2">
              <button 
                onClick={() => exportLogsToCSV(filteredLogs, profile.shopId)}
                className="sleek-button bg-surface-container-high text-on-surface border-outline hover:bg-surface-container-highest flex items-center gap-2"
                title="Export CSV"
              >
                <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button 
                onClick={() => exportLogsToPDF(filteredLogs, profile.shopId)}
                className="sleek-button bg-surface-container-high text-on-surface border-outline hover:bg-surface-container-highest flex items-center gap-2"
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

      <div className="flex flex-col md:flex-row gap-4 bg-surface p-4 rounded-2xl border border-outline">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Search by tail number, name, JCN, or discrepancy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-10 w-full"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1">Start Date</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sleek-input"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1">End Date</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sleek-input"
            />
          </div>
        </div>
      </div>

      <div className={cn("grid gap-6", viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
        <AnimatePresence>
          {filteredLogs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("sleek-card flex flex-col justify-between", viewMode === 'list' && "md:flex-row md:items-center gap-6")}
            >
              <div className={cn(viewMode === 'list' && "flex-1 grid grid-cols-1 md:grid-cols-4 gap-4")}>
                <div className="flex justify-between items-start mb-4 md:mb-0 md:col-span-1">
                  <div className="flex flex-col">
                    <span className="text-on-surface-variant text-[10px] font-bold tracking-wider mb-1 uppercase">
                      {log.jcn ? `JCN: ${log.jcn}` : `Log ID: #${log.id?.slice(0, 6)}`}
                    </span>
                    <h3 className="text-xl font-bold text-on-background">{log.tail_number}</h3>
                  </div>
                  {log.isRedBall && (
                    <span className="badge badge-danger md:hidden">Red Ball</span>
                  )}
                </div>
                
                <div className={cn("space-y-3 mb-6 md:mb-0", viewMode === 'list' && "md:col-span-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0")}>
                  <div className="flex justify-between border-b border-outline pb-2 md:border-none md:flex-col md:justify-center">
                    <span className="text-on-surface-variant text-[10px] font-semibold uppercase">Personnel</span>
                    <span className="text-on-surface text-xs font-medium">
                      {log.technician_name}
                      {log.personnel && log.personnel.length > 0 && ` + ${log.personnel.length} more`}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-outline pb-2 md:border-none md:flex-col md:justify-center">
                    <span className="text-on-surface-variant text-[10px] font-semibold uppercase">Date</span>
                    <span className="text-on-surface text-xs font-medium">
                      {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy.MM.dd') : 'Pending'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-1">
                    <span className="text-primary text-[10px] font-bold uppercase">Discrepancy</span>
                    <p className="text-on-surface text-xs italic leading-relaxed line-clamp-3 md:line-clamp-2">{log.discrepancy}</p>
                  </div>
                </div>
              </div>
              
              <div className={cn(viewMode === 'list' && "flex flex-col items-end gap-2 min-w-[120px]")}>
                {log.isRedBall && viewMode === 'list' && (
                  <span className="badge badge-danger">Red Ball</span>
                )}
                <button className={cn("bg-surface-container-high text-on-surface font-semibold py-2 rounded-lg text-xs hover:bg-surface-container-highest transition-all", viewMode === 'grid' ? "w-full" : "px-4")}>
                  View Details
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Entry Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-6 border-b border-outline flex justify-between items-center">
                <h3 className="font-bold text-xl text-on-background tracking-tight">New Maintenance Entry</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-on-background">
                  <X />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tail Number</label>
                    <input 
                      required
                      className="sleek-input"
                      placeholder="AF-00-0000"
                      value={formData.tail_number}
                      onChange={e => setFormData({...formData, tail_number: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">JCN (Job Control Number)</label>
                    <input 
                      className="sleek-input"
                      placeholder="E.G. 231450012"
                      value={formData.jcn}
                      onChange={e => setFormData({...formData, jcn: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Additional Personnel (Comma Separated)</label>
                  <input 
                    className="sleek-input"
                    placeholder="E.G. Smith J, Doe A"
                    value={formData.personnelInput}
                    onChange={e => setFormData({...formData, personnelInput: e.target.value})}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Red Ball Status</label>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, isRedBall: !formData.isRedBall})}
                    className={cn(
                      "sleek-input flex items-center justify-center gap-2",
                      formData.isRedBall ? "bg-error text-white border-error" : "bg-surface-container-high text-on-surface-variant"
                    )}
                  >
                    <ShieldAlert className="w-4 h-4" /> {formData.isRedBall ? 'URGENT' : 'NORMAL'}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Discrepancy</label>
                    <textarea 
                      required
                      rows={3}
                      className="sleek-input resize-none"
                      placeholder="Describe the malfunction..."
                      value={formData.discrepancy}
                      onChange={e => setFormData({...formData, discrepancy: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Repair Action</label>
                    <textarea 
                      required
                      rows={3}
                      className="sleek-input resize-none"
                      placeholder="Describe the corrective action..."
                      value={formData.repair}
                      onChange={e => setFormData({...formData, repair: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Document Number (Optional)</label>
                  <input 
                    className="sleek-input"
                    placeholder="E.G. 92144A001"
                    value={formData.doc_number}
                    onChange={e => setFormData({...formData, doc_number: e.target.value})}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="sleek-button w-full flex items-center justify-center gap-3 py-3"
                >
                  {loading ? 'Transmitting...' : 'Submit Entry'} <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TrainingTracker: React.FC = () => {
  const { profile } = useAuth();
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

    const isLeadership = profile.role === 'leadership';
    const isTechnician = profile.role === 'technician';

    if (profile.uid === 'mock-user-123') {
      if (isLeadership) {
        setTraining(MOCK_TRAINING);
        setPersonnel(MOCK_PERSONNEL);
      } else if (isTechnician) {
        setTraining(MOCK_TRAINING.filter(t => t.man_number === profile.man_number));
        setPersonnel(MOCK_PERSONNEL.filter(p => p.man_number === profile.man_number));
      } else {
        setTraining(MOCK_TRAINING.filter(t => t.shopId === profile.shopId));
        setPersonnel(MOCK_PERSONNEL.filter(p => p.shopId === profile.shopId));
      }
      return;
    }

    let qTraining;
    if (isLeadership) {
      qTraining = query(collection(db, 'training'));
    } else if (isTechnician) {
      qTraining = query(collection(db, 'training'), where('man_number', '==', profile.man_number));
    } else {
      qTraining = query(collection(db, 'training'), where('shopId', '==', profile.shopId));
    }
    
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingRecord)));
    });

    let qPersonnel;
    if (isLeadership) {
      qPersonnel = query(collection(db, 'users'));
    } else if (isTechnician) {
      qPersonnel = query(collection(db, 'users'), where('man_number', '==', profile.man_number));
    } else {
      qPersonnel = query(collection(db, 'users'), where('shopId', '==', profile.shopId));
    }
    
    const unsubPersonnel = onSnapshot(qPersonnel, (snap) => {
      setPersonnel(snap.docs.map(d => d.data() as UserProfile));
    });

    return () => {
      unsubTraining();
      unsubPersonnel();
    };
  }, [profile]);

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
            status
          };

          if (profile.uid === 'mock-user-123') {
            newRecords.push({ id: `mock-${Math.random()}`, ...trainingData });
          } else {
            await addDoc(collection(db, 'training'), trainingData);
          }
        }

        if (profile.uid === 'mock-user-123') {
          setTraining([...newRecords, ...training]);
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

  const filteredTraining = training.filter(record => {
    const personName = getPersonName(record.man_number);
    const matchesSearch = 
      record.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-background">Training Readiness</h2>
          <p className="text-on-surface-variant font-medium text-sm mt-1">Task Expiration Forecast // 60-Day Window</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-surface-container-high rounded-xl p-1 border border-outline">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 rounded-lg transition-colors", viewMode === 'grid' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface")}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-colors", viewMode === 'list' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
            <div className="flex gap-2">
              <button 
                onClick={() => exportTrainingToCSV(filteredTraining, profile.shopId)}
                className="sleek-button bg-surface-container-high text-on-surface border-outline hover:bg-surface-container-highest flex items-center gap-2"
                title="Export CSV"
              >
                <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button 
                onClick={() => exportTrainingToPDF(filteredTraining, profile.shopId)}
                className="sleek-button bg-surface-container-high text-on-surface border-outline hover:bg-surface-container-highest flex items-center gap-2"
                title="Export PDF"
              >
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          )}
          <BarChart3 className="text-primary w-10 h-10 hidden sm:block" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-surface p-4 rounded-2xl border border-outline">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Search by course name, man #, or personnel name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-10 w-full"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1">Due After</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sleek-input"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1">Due Before</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sleek-input"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Area */}
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
          <div className="lg:col-span-12">
            <div className="sleek-card !p-0 overflow-hidden">
              <label className="p-12 flex flex-col items-center justify-center text-center space-y-4 hover:bg-surface-container-high transition-colors group cursor-pointer">
                <input type="file" className="sr-only" onChange={handleFileUpload} disabled={isUploading} />
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  {isUploading ? <Clock className="w-8 h-8 animate-spin" /> : <UploadCloud className="w-8 h-8" />}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-on-background tracking-tight">
                    {isUploading ? 'Parsing in Progress...' : 'Training Report Upload'}
                  </h3>
                  <p className="text-sm text-on-surface-variant max-w-md mx-auto mt-2">
                    Drop Excel-formatted (.xlsx, .xlsm, .csv) personnel training logs here. The system will automatically parse and sync with the database.
                  </p>
                </div>
                <div className="sleek-button">
                  {isUploading ? 'Processing...' : 'Browse Files'}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Readiness Widgets */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="sleek-card space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Fully Qualified</span>
              <span className="text-on-background font-bold">{Math.round((stats.current / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${(stats.current / stats.total) * 100}%` }}></div>
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium uppercase">{stats.current} Personnel Current</p>
          </div>

          <div className="sleek-card space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-tertiary text-xs font-bold uppercase tracking-wider">Expiring &lt; 60 Days</span>
              <span className="text-on-background font-bold">{Math.round((stats.expiring / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-tertiary" style={{ width: `${(stats.expiring / stats.total) * 100}%` }}></div>
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium uppercase">{stats.expiring} Personnel Require Scheduling</p>
          </div>

          <div className="sleek-card space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-error text-xs font-bold uppercase tracking-wider">Expired / Delinquent</span>
              <span className="text-on-background font-bold">{Math.round((stats.expired / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-error" style={{ width: `${(stats.expired / stats.total) * 100}%` }}></div>
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium uppercase">{stats.expired} Personnel Non-Mission Capable</p>
          </div>
        </div>

        <div className="lg:col-span-12">
          {viewMode === 'list' ? (
            <div className="sleek-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high text-[11px] font-bold text-on-surface-variant tracking-wider uppercase">
                      <th className="px-6 py-4">Course Name</th>
                      <th className="px-6 py-4">Man #</th>
                      {profile?.role === 'leadership' && <th className="px-6 py-4">Shop</th>}
                      <th className="px-6 py-4">Due Date</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {filteredTraining.map((record) => (
                      <tr 
                        key={record.id} 
                        className="hover:bg-surface-container-high transition-colors cursor-pointer"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-on-background">{record.course_name}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-0.5">{getPersonName(record.man_number)}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{record.man_number}</td>
                        {profile?.role === 'leadership' && <td className="px-6 py-4 text-sm text-on-surface-variant font-bold">{record.shopId}</td>}
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{record.due_date}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "badge",
                            record.status === 'current' ? "badge-success" : 
                            record.status === 'expiring' ? "badge-warning" : "badge-danger"
                          )}>
                            {record.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTraining.map((record) => (
                <div 
                  key={record.id} 
                  className="sleek-card cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-on-background">{record.course_name}</h4>
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-1">{getPersonName(record.man_number)}</p>
                    </div>
                    <span className={cn(
                      "badge",
                      record.status === 'current' ? "badge-success" :
                      record.status === 'expiring' ? "badge-warning" : "badge-danger"
                    )}>
                      {record.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-outline pb-2">
                      <span className="text-on-surface-variant text-[10px] font-semibold uppercase">Man #</span>
                      <span className="text-on-surface text-xs font-medium">{record.man_number}</span>
                    </div>
                    {profile?.role === 'leadership' && (
                      <div className="flex justify-between border-b border-outline pb-2">
                        <span className="text-on-surface-variant text-[10px] font-semibold uppercase">Shop</span>
                        <span className="text-on-surface text-xs font-bold">{record.shopId}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-outline pb-2">
                      <span className="text-on-surface-variant text-[10px] font-semibold uppercase">Due Date</span>
                      <span className="text-on-surface text-xs font-medium">{record.due_date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecord(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface rounded-3xl shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className={cn(
                      "badge mb-2",
                      selectedRecord.status === 'current' ? "badge-success" : 
                      selectedRecord.status === 'expiring' ? "badge-warning" : "badge-danger"
                    )}>
                      {selectedRecord.status.toUpperCase()}
                    </span>
                    <h3 className="text-2xl font-bold text-on-background leading-tight">
                      {selectedRecord.course_name}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedRecord(null)}
                    className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-on-surface-variant" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Assigned Personnel</p>
                    <p className="text-lg font-semibold text-on-background">{getPersonName(selectedRecord.man_number)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Man Number</p>
                    <p className="text-lg font-semibold text-on-background">{selectedRecord.man_number}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Due Date</p>
                    <p className="text-lg font-semibold text-on-background">{selectedRecord.due_date}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Shop ID</p>
                    <p className="text-lg font-semibold text-on-background">{selectedRecord.shopId}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-outline">
                  <div className="bg-surface-container-low p-4 rounded-2xl border border-outline flex items-start gap-4">
                    <ShieldAlert className={cn(
                      "w-6 h-6 shrink-0 mt-1",
                      selectedRecord.status === 'current' ? "text-emerald-500" : 
                      selectedRecord.status === 'expiring' ? "text-tertiary" : "text-error"
                    )} />
                    <div>
                      <p className="font-bold text-on-background text-sm">Readiness Impact</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {selectedRecord.status === 'current' 
                          ? "This individual is fully qualified for this task. No immediate action required."
                          : selectedRecord.status === 'expiring'
                          ? "Qualification expires within 60 days. Schedule training to avoid mission impact."
                          : "Qualification has EXPIRED. Individual is non-mission capable for tasks requiring this certification."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setSelectedRecord(null)}
                    className="sleek-button flex-1 py-3"
                  >
                    Close Details
                  </button>
                  {profile?.role === 'ncoic' && (
                    <button className="sleek-button bg-surface-container-high text-on-surface border-outline hover:bg-surface-container-highest px-6">
                      Update
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Personnel: React.FC = () => {
  const { profile } = useAuth();
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<UserProfile | null>(null);
  const [personTraining, setPersonTraining] = useState<TrainingRecord[]>([]);
  const [personLogs, setPersonLogs] = useState<MaintenanceLog[]>([]);

  useEffect(() => {
    if (!profile) return;

    const isLeadership = profile.role === 'leadership';

    if (profile.uid === 'mock-user-123') {
      setPersonnel(isLeadership ? MOCK_PERSONNEL : MOCK_PERSONNEL.filter(p => p.shopId === profile.shopId));
      return;
    }

    const q = isLeadership
      ? query(collection(db, 'users'), where('status', '==', 'active'))
      : query(collection(db, 'users'), where('shopId', '==', profile.shopId), where('status', '==', 'active'));
    
    const unsub = onSnapshot(q, (snap) => {
      setPersonnel(snap.docs.map(d => d.data() as UserProfile));
    });
    return unsub;
  }, [profile]);

  useEffect(() => {
    if (!selectedPerson || !profile) return;

    if (profile.uid === 'mock-user-123') {
      setPersonTraining(MOCK_TRAINING.filter(t => t.man_number === selectedPerson.man_number));
      setPersonLogs(MOCK_LOGS.filter(l => l.man_number === selectedPerson.man_number));
      return;
    }

    const qTraining = query(
      collection(db, 'training'),
      where('man_number', '==', selectedPerson.man_number)
    );
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setPersonTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingRecord)));
    });

    const qLogs = query(
      collection(db, 'logs'),
      where('man_number', '==', selectedPerson.man_number)
    );
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setPersonLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    });

    return () => {
      unsubTraining();
      unsubLogs();
    };
  }, [selectedPerson, profile]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-background">Personnel Roster</h2>
          <p className="text-on-surface-variant font-medium text-sm mt-1">Shop Personnel & Qualifications</p>
        </div>
        <Users className="text-primary w-10 h-10" />
      </div>

      <div className="sleek-card !p-0 overflow-hidden">
        <div className="p-6 border-b border-outline flex justify-between items-center bg-surface">
          <h3 className="font-bold text-lg text-on-background tracking-tight">Active Duty Roster</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input className="sleek-input pl-10 py-2 text-xs w-64" placeholder="Filter Roster..." />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-[11px] font-bold text-on-surface-variant tracking-wider uppercase">
                <th className="px-6 py-4">Name / Rank</th>
                <th className="px-6 py-4">Man #</th>
                {profile?.role === 'leadership' && <th className="px-6 py-4">Shop</th>}
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {personnel.map((p) => (
                <tr 
                  key={p.uid} 
                  className="hover:bg-surface-container-high transition-colors cursor-pointer"
                  onClick={() => setSelectedPerson(p)}
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-on-background">{p.name}</p>
                    <p className="text-[11px] text-on-surface-variant">{p.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">{p.man_number}</td>
                  {profile?.role === 'leadership' && <td className="px-6 py-4 text-sm text-on-surface-variant font-bold">{p.shopId}</td>}
                  <td className="px-6 py-4">
                    <span className={cn(
                      "badge",
                      p.role === 'ncoic' ? "badge-info" : "bg-slate-100 text-slate-600"
                    )}>
                      {p.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-xs font-medium text-on-surface-variant">Active</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedPerson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPerson(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-surface rounded-3xl shadow-2xl overflow-hidden border border-outline flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-outline bg-surface-container-low flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-on-background leading-tight">{selectedPerson.name}</h3>
                    <p className="text-sm text-on-surface-variant mt-1">{selectedPerson.role.toUpperCase()} • MAN #: {selectedPerson.man_number}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPerson(null)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-on-surface-variant" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Training History */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <h4 className="font-bold text-on-background uppercase tracking-wider text-sm">Training History</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {personTraining.length > 0 ? personTraining.map(t => (
                      <div key={t.id} className="bg-surface-container-low p-4 rounded-2xl border border-outline flex justify-between items-center">
                        <div>
                          <p className="font-bold text-on-background">{t.course_name}</p>
                          <p className="text-xs text-on-surface-variant mt-1">Due Date: {t.due_date}</p>
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
                      <p className="text-sm text-on-surface-variant italic p-4 bg-surface-container-low rounded-2xl border border-outline border-dashed text-center">No training records found.</p>
                    )}
                  </div>
                </section>

                {/* Recent Maintenance */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary" />
                    <h4 className="font-bold text-on-background uppercase tracking-wider text-sm">Recent Maintenance Logs</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {personLogs.length > 0 ? personLogs.map(l => (
                      <div key={l.id} className="bg-surface-container-low p-4 rounded-2xl border border-outline">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-bold text-on-background">{l.tail_number}</p>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{format(l.timestamp.toDate(), 'MMM dd, yyyy')}</p>
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-2"><span className="font-bold text-on-background">DISC:</span> {l.discrepancy}</p>
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2"><span className="font-bold text-on-background">REPAIR:</span> {l.repair}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-on-surface-variant italic p-4 bg-surface-container-low rounded-2xl border border-outline border-dashed text-center">No maintenance logs found for this individual.</p>
                    )}
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-outline bg-surface-container-low flex gap-3">
                <button 
                  onClick={() => setSelectedPerson(null)}
                  className="sleek-button flex-1 py-3"
                >
                  Close Profile
                </button>
                {profile?.role === 'ncoic' && (
                  <button className="sleek-button bg-primary text-white px-8">
                    Edit Personnel
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

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
        <Route path="/training" element={<TrainingTracker />} />
        <Route path="/personnel" element={<Personnel />} />
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && <Route path="/onboarding" element={<Onboarding />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
