import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import React, { Component, useEffect, useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation
} from 'react-router-dom';
import { User } from 'firebase/auth';
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
  Activity,
  Package,
  History as HistoryIcon,
  AlertTriangle,
  MoreVertical,
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
  Sparkles,
  Camera,
  Loader2,
  Trash2,
  CheckCircle2,
  Eye,
  Check,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  BellDot
} from 'lucide-react';
import { format, addDays, isBefore, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db, handleFirestoreError, OperationType, FirestoreErrorInfo } from './firebase';
import { UserProfile, MaintenanceLog, TrainingRecord, UserRole, AMUType, ShiftType, DIFMLog, Notification, NotificationType, UserPresence } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

import { cn } from './lib/utils';

const createNotification = async (notif: Omit<Notification, 'timestamp' | 'isRead'>) => {
  try {
    const newNotif = {
      ...notif,
      isRead: false,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'notifications'), newNotif);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

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
import { parseTrainingReport } from './services/parserService';
import { 
  exportLogsToCSV, 
  exportLogsToPDF, 
  exportTrainingToCSV, 
  exportTrainingToPDF,
  exportTurnoverToPDF
} from './lib/exportUtils';
import { scanMaintenanceForm, scanLogBook } from './services/ocrService';
import { SHOPS, ShopType, AMUS, SHIFT_TIMES, MOCK_LOGS, MOCK_PERSONNEL, MOCK_TRAINING, MOCK_DIFM } from './mockData';

// --- Components ---

// Tour component removed

// --- Real-time Presence ---

const usePresence = (location: string) => {
  const { user, profile, isDemoMode } = useAuth();
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!user || !profile || !profile.shopId) return;

    const presenceRef = doc(db, 'presence', user.uid);
    const updatePresence = async () => {
      try {
        await setDoc(presenceRef, {
          userId: user.uid,
          userName: profile.name,
          location,
          activeAt: serverTimestamp(),
          shopId: profile.shopId,
          amuId: profile.amuId,
          isDemo: isDemoMode
        });
      } catch (e) {
        console.error("Presence update failed", e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Heartbeat every 30s

    const q = query(
      collection(db, 'presence'),
      where('amuId', '==', profile.amuId),
      where('shopId', '==', profile.shopId),
      where('isDemo', '==', isDemoMode)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const users = snapshot.docs
        .map(d => d.data() as UserPresence)
        .filter(u => {
          if (u.userId === user.uid) return false;
          // Only show users active in the last 2 minutes
          const activeAt = u.activeAt?.toDate ? u.activeAt.toDate() : new Date(0);
          return (now.getTime() - activeAt.getTime()) < 120000;
        });
      setActiveUsers(users);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [user, profile, location]);

  return activeUsers;
};

const PresenceIndicator: React.FC<{ users: UserPresence[] }> = ({ users }) => {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {users.map(u => (
        <div 
          key={u.userId}
          className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center group relative cursor-help"
          title={`${u.userName} is also on this page`}
        >
          <span className="text-[10px] font-black text-slate-600">
            {u.userName.split(',')[0].slice(0, 2).toUpperCase()}
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-sidebar text-white text-[8px] font-black uppercase tracking-tighter rounded-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-[200]">
            {u.userName} <span className="text-primary/60 ml-1">// {u.location}</span>
          </div>
          <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white"></div>
        </div>
      ))}
      <span className="ml-4 text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">
        {users.length} {users.length === 1 ? 'other tech' : 'other techs'} active
      </span>
    </div>
  );
};

const NotificationBell: React.FC = () => {
  const { user, profile, isDemoMode } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !profile || !profile.shopId) return;

    const q = query(
      collection(db, 'notifications'),
      where('shopId', '==', profile.shopId),
      where('isDemo', '==', isDemoMode),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user, profile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { isRead: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'red-ball': return <ShieldAlert className="w-4 h-4 text-safety-orange" />;
      case 'parts': return <Package className="w-4 h-4 text-primary" />;
      case 'training': return <Clock className="w-4 h-4 text-caution-yellow" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-sidebar-foreground/5 hover:bg-sidebar-foreground/10 transition-colors border border-white/10"
      >
        {unreadCount > 0 ? (
          <>
            <BellDot className="w-5 h-5 text-primary" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-black flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-5 h-5 text-white/40" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 bg-white border border-outline shadow-2xl z-[150] overflow-hidden"
          >
            <div className="p-4 bg-slate-50 border-b border-outline flex justify-between items-center">
              <span className="tech-label text-primary">Operational Alerts</span>
              {unreadCount > 0 && <span className="text-[8px] font-black uppercase text-slate-400 px-2 py-0.5 bg-white border border-outline">{unreadCount} New</span>}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-outline custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto" />
                  <p className="tech-label text-[9px] text-slate-400">All Systems Nominal // No Active Alerts</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    className={cn(
                      "p-4 hover:bg-slate-50 transition-colors cursor-pointer relative",
                      !notif.isRead && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (!notif.isRead) markAsRead(notif.id!);
                    }}
                  >
                    {!notif.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                    <div className="flex gap-3">
                      <div className="mt-0.5">{getIcon(notif.type)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-black text-[10px] uppercase tracking-tight text-slate-900 leading-tight">{notif.title}</p>
                          <span className="text-[8px] font-mono text-slate-400 whitespace-nowrap">
                            {notif.timestamp?.toDate ? format(notif.timestamp.toDate(), 'HH:mm') : '...'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium line-clamp-2">{notif.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 bg-slate-50 border-t border-outline text-center">
              <button 
                onClick={() => setIsOpen(false)}
                className="tech-label text-[8px] hover:text-primary transition-colors uppercase tracking-[0.2em]"
              >
                Close Comms
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, logout, setShop, setAMU, setRole, isDemoMode, toggleDemoMode } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [isAMUDropdownOpen, setIsAMUDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();

  // Presence logic
  const activeUsers = usePresence(location.pathname);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Maintenance Log', path: '/maintenance', icon: Wrench },
    { name: 'DIFM Log', path: '/difm', icon: FileDown },
    { name: 'G081 Gallery', path: '/g081', icon: Camera },
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
        <div className="branding px-8 py-12">
          <div className="flex items-start gap-4">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="font-black text-5xl tracking-tighter leading-none text-white">92</span>
                <div className="flex flex-col">
                  <span className="text-primary font-black text-xs uppercase tracking-widest leading-none">nd</span>
                  <span className="text-white font-black text-lg tracking-tighter uppercase leading-none">AMXS</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10"></div>
                <span className="tech-label text-white/30 text-[8px] whitespace-nowrap tracking-[0.3em]">Maintenance Control</span>
                <div className="h-px flex-1 bg-white/10"></div>
              </div>
            </div>
          </div>
        </div>

        {(isDemoMode || profile?.role === 'ncoic' || profile?.role === 'leadership') && (
          <div className="px-8 pb-8 space-y-6 border-b border-white/10">
            {isDemoMode && (
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
            )}

            <div className="relative">
              <p className="text-[11px] uppercase tracking-widest text-white/60 mb-2 font-bold">{profile?.role === 'leadership' ? 'Oversight AMU' : 'Assigned AMU'}</p>
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
                    {['ALL', ...AMUS].map(amu => (
                      <button
                        key={amu}
                        onClick={() => {
                          setAMU(amu as AMUType);
                          setIsAMUDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-xs hover:bg-white/10 transition-colors uppercase font-mono tracking-tighter",
                          profile?.amuId === amu ? "text-primary font-bold bg-white/5" : "text-white/60"
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
              <p className="text-[11px] uppercase tracking-widest text-white/60 mb-2 font-bold">{profile?.role === 'leadership' ? 'Oversight Shop' : 'Assigned Shop'}</p>
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
                    {['ALL', ...SHOPS].map(shop => (
                      <button
                        key={shop}
                        onClick={() => {
                          setShop(shop as ShopType);
                          setIsShopDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-xs hover:bg-white/10 transition-colors uppercase font-mono tracking-tighter",
                          profile?.shopId === shop ? "text-primary font-bold bg-white/5" : "text-white/60"
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
          <div className="text-right hidden sm:flex items-start gap-10">
            <div className="flex items-center gap-6">
              <PresenceIndicator users={activeUsers} />
              <NotificationBell />
              <div className="flex flex-col items-end pt-1">
                <div className={cn(
                  "flex items-center gap-2 px-2 py-0.5 rounded-none text-[9px] font-black uppercase tracking-widest border transition-all",
                  isOnline 
                    ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" 
                    : "bg-red-500/5 text-red-500 border-red-500/20"
                )}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? 'System Online / Sync Active' : 'Offline Mode / Local Cache'}
                </div>
                {!isOnline && (
                  <p className="text-[8px] text-red-400 mt-1 font-bold animate-pulse">CHANGES WILL SYNC ON RECONNECT</p>
                )}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">{profile?.rank} {profile?.name}</div>
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-2">{profile?.role} • {profile?.amuId} • {profile?.shopId}</div>
              <button 
                onClick={logout}
                className="ml-auto flex items-center gap-2 hover:text-safety-orange transition-colors text-slate-400 font-bold text-[10px] uppercase tracking-widest"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
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
        className="md:hidden fixed bottom-6 left-6 z-50 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center"
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

// --- Intelligence Feed ---

const IntelligenceFeed: React.FC<{ logs: MaintenanceLog[], training: TrainingRecord[] }> = ({ logs, training }) => {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<{ id: string, type: 'critical' | 'warning' | 'info', title: string, description: string, time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateIntelligence = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        // Prepare data for analysis
        const recentLogs = logs.slice(0, 15).map(l => `${l.tail_number} (${l.isRedBall ? 'RED BALL' : 'Standard'}): ${l.discrepancy}`);
        const imminentTraining = training.filter(t => t.status !== 'current').slice(0, 10).map(t => `${t.course_name} for Man ${t.man_number} due ${t.due_date}`);
        
        if (recentLogs.length === 0 && imminentTraining.length === 0) {
          setAlerts([{
            id: 'no-data',
            type: 'info',
            title: 'Operation Static',
            description: 'Insufficient shop data for trend analysis. Analysis engine monitoring for new inputs.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          setLoading(false);
          return;
        }

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ 
            role: "user", 
            parts: [{ 
              text: `SYSTEM ROLE: 92nd AMXS Operational Intelligence Engine.
              MISSION: Provide forensic analysis of maintenance and training data.
              
              DATA SOURCE (Shop: ${profile.shopId}, AMU: ${profile.amuId}):
              Logs: ${recentLogs.join(' | ')}
              Training Due: ${imminentTraining.join(' | ')}
              
              TASK: Identify 1-3 significant trends or critical readiness alerts based ONLY on the provided data. 
              STRICT NEGATIVE CONSTRAINT: Do NOT hallucinate or assume data. If data is sparse or shows no significant issues, return an empty array or only include factual observations (e.g. "Low volume of maintenance entries detected").
              
              OUTPUT: JSON array [ { "type": "critical" | "warning" | "info", "title": string, "description": string } ]` 
            }] 
          }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.1 // Lower temperature for more forensic accuracy
          }
        });

        const data = JSON.parse(response.text);
        if (data.length === 0) {
          setAlerts([{
            id: 'nominal',
            type: 'info',
            title: 'System Nominal',
            description: 'No significant readiness trends or critical alerts identified from recent data blocks.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        } else {
          setAlerts(data.map((a: any, i: number) => ({
            ...a,
            id: `intel-${i}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        }
      } catch (err) {
        console.error("Intelligence Feed Error:", err);
        setAlerts([{
          id: 'err',
          type: 'info',
          title: 'System Analysis Paused',
          description: 'Connection to operational intelligence engine is throttled. Monitoring manually.',
          time: '--:--'
        }]);
      } finally {
        setLoading(false);
      }
    };

    generateIntelligence();
    const interval = setInterval(generateIntelligence, 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, [profile, logs.length, training.length]);

  return (
    <div className="visible-grid bg-white border border-outline h-full">
      <div className="p-6 border-b border-outline bg-slate-50 flex justify-between items-center">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Mission Intelligence</h3>
          <p className="tech-label mt-1 text-slate-400">Live Readiness Analysis // 92 AMXS</p>
        </div>
        <Activity className={cn("w-4 h-4 text-primary", loading && "animate-pulse")} />
      </div>
      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {loading && alerts.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="flex justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-primary animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <p className="tech-label text-[8px] text-slate-400 uppercase">Processing Field Intelligence...</p>
          </div>
        ) : (
          alerts.map(alert => (
            <motion.div 
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-slate-50 border-l-4 border-l-primary flex gap-4 shadow-sm"
              style={{ borderLeftColor: alert.type === 'critical' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6' }}
            >
              <div className={cn(
                "w-8 h-8 flex items-center justify-center shrink-0 rounded-none",
                alert.type === 'critical' ? "bg-red-100 text-red-600" : alert.type === 'warning' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
              )}>
                {alert.type === 'critical' ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-[11px] font-black uppercase tracking-tight text-slate-900">{alert.title}</h4>
                  <span className="tech-label text-[8px] opacity-40">{alert.time}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed serif-header">{alert.description}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [difm, setDifm] = useState<DIFMLog[]>([]);

  useEffect(() => {
    if (!profile) return;

    const isGlobal = profile.role === 'leadership' && (profile.amuId === 'ALL' || profile.shopId === 'ALL');
    
    if (isDemoMode) {
      const filteredMockLogs = MOCK_LOGS.filter(l => {
        if (profile.amuId !== 'ALL' && l.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && l.shopId !== profile.shopId) return false;
        return true;
      }).sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
      setLogs(filteredMockLogs);

      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (profile.amuId !== 'ALL' && p.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && p.shopId !== profile.shopId) return false;
        return true;
      });
      setPersonnel(filteredMockPersonnel);

      const filteredMockTraining = MOCK_TRAINING.filter(t => {
        if (profile.amuId !== 'ALL' && t.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && t.shopId !== profile.shopId) return false;
        return true;
      });
      setTraining(filteredMockTraining);

      const filteredMockDifm = MOCK_DIFM.filter(d => {
        if (profile.amuId !== 'ALL' && d.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && d.shopId !== profile.shopId) return false;
        return true;
      });
      setDifm(filteredMockDifm);
      return;
    }

    let qLogs;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL' || profile.role === 'leadership') {
      // Leadership or ALL view
      let queryRef = collection(db, 'logs');
      const constraints: any[] = [where('isDemo', '==', false), orderBy('timestamp', 'desc')];
      
      if (profile.amuId !== 'ALL' && profile.role !== 'leadership') {
        constraints.unshift(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.role !== 'leadership') {
        constraints.unshift(where('shopId', '==', profile.shopId));
      }

      // If leadership but they chose a specific filter
      if (profile.role === 'leadership') {
        if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
          constraints.unshift(where('amuId', '==', profile.amuId));
        }
        if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
          constraints.unshift(where('shopId', '==', profile.shopId));
        }
      }

      qLogs = query(queryRef, ...constraints);
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
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));

    let qPersonnel;
    if (profile.role === 'leadership') {
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
      setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    let qTraining;
    if (profile.role === 'leadership') {
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
      setTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'training'));

    let qDifm;
    if (profile.role === 'leadership') {
      qDifm = query(collection(db, 'difm'), where('isDemo', '==', false));
    } else {
      qDifm = query(
        collection(db, 'difm'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }

    const unsubDifm = onSnapshot(qDifm, (snap) => {
      setDifm(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'difm'));

    return () => {
      unsubLogs();
      unsubPersonnel();
      unsubTraining();
      unsubDifm();
    };
  }, [profile, isDemoMode]);

  const urgentLogs = logs.filter(l => l.isRedBall).length;
  const currentTraining = training.filter(t => t.status === 'current').length;
  const totalTraining = training.length || 1;
  const readiness = Math.round((currentTraining / totalTraining) * 100);

  return (
    <div className="space-y-10">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 text-on-background">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
            <img 
              src="https://media.defense.gov/2022/Sep/29/2003087437/-1/-1/0/220929-F-AFHRA-020.JPG" 
              alt="92nd AMXS" 
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply' }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none">Command Dashboard</h2>
            <div className="flex items-center gap-2 sm:gap-3 mt-2">
              <span className="tech-label text-primary font-bold tracking-widest text-[11px]">92ND AMXS</span>
              <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
              <p className="serif-header text-sm text-slate-500 italic">Operational Readiness & Oversight</p>
            </div>
          </div>
        </div>
        <div className="flex gap-4 w-full lg:w-auto">
          <button 
            onClick={() => exportTurnoverToPDF(logs, difm, (profile as any).shopId, (profile as any).amuId, 'Days')}
            className="sleek-button flex-1 lg:flex-none bg-sidebar !text-white border border-white/10 hover:bg-slate-800 flex items-center justify-center gap-3 px-8 group"
          >
            <HistoryIcon className="w-4 h-4 text-white group-hover:scale-110 transition-transform" /> 
            <span className="font-black text-[11px] uppercase tracking-widest">Turnover Report</span>
          </button>
        </div>
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
        {/* Intelligence Feed */}
        <div className="lg:col-span-4">
          <IntelligenceFeed logs={logs} training={training} />
        </div>

        {/* Personnel Roster */}
        <div className="lg:col-span-8">
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
  const [difm, setDifm] = useState<DIFMLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tail_number: '',
    jcn: '',
    discrepancy: '',
    repair: '',
    doc_number: '',
    personnelInput: '',
    isRedBall: false,
    shift: 'Days' as ShiftType,
    g081Photo: ''
  });
  const [loading, setLoading] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isG081Uploading, setIsG081Uploading] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const g081InputRef = useRef<HTMLInputElement>(null);
  const bulkScanInputRef = useRef<HTMLInputElement>(null);
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const isLeadership = profile.role === 'leadership';
      const filteredMockLogs = MOCK_LOGS.filter(log => {
        if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
        if (profile.amuId !== 'ALL' && log.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && log.shopId !== profile.shopId) return false;
        return true;
      });
      setLogs(filteredMockLogs);

      const filteredMockDifm = MOCK_DIFM.filter(d => {
        if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
        if (profile.amuId !== 'ALL' && d.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && d.shopId !== profile.shopId) return false;
        return true;
      });
      setDifm(filteredMockDifm);
      return;
    }

    let qLogs;
    const logConstraints: any[] = [where('isDemo', '==', false), orderBy('timestamp', 'desc')];
    if (profile.amuId !== 'ALL') logConstraints.unshift(where('amuId', '==', profile.amuId));
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') logConstraints.unshift(where('shopId', '==', profile.shopId));
    qLogs = query(collection(db, 'logs'), ...logConstraints);
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));

    let qDifm;
    const difmConstraints: any[] = [where('isDemo', '==', false)];
    if (profile.amuId !== 'ALL') difmConstraints.unshift(where('amuId', '==', profile.amuId));
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') difmConstraints.unshift(where('shopId', '==', profile.shopId));
    qDifm = query(collection(db, 'difm'), ...difmConstraints);

    const unsubDifm = onSnapshot(qDifm, (snap) => {
      setDifm(snap.docs.map(d => ({ id: d.id, ...d.data() } as DIFMLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'difm'));

    return () => {
      unsubLogs();
      unsubDifm();
    };
  }, [profile, isDemoMode]);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const result = await scanMaintenanceForm(base64);
      if (result) {
        setFormData(prev => ({
          ...prev,
          tail_number: result.tail_number || prev.tail_number,
          discrepancy: result.discrepancy || prev.discrepancy,
          repair: result.repair || prev.repair,
          jcn: result.jcn || prev.jcn,
          doc_number: result.doc_number || prev.doc_number
        }));
      }
    } catch (error) {
      console.error("Scanning failed:", error);
      alert("Failed to parse form. Please try a clearer picture.");
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleScanLogbook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert("Please select a specific AMU and Shop before bulk scanning logbooks.");
      return;
    }

    setIsBulkScanning(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const results = await scanLogBook(base64);
      if (results && results.length > 0) {
        if (!window.confirm(`Found ${results.length} maintenance entries. Import them all into ${profile.amuId} AMU - ${profile.shopId} Shop?`)) {
          return;
        }

        const batch = results.map(result => ({
          tail_number: result.tail_number || 'UNKNOWN',
          jcn: result.jcn || '',
          discrepancy: result.discrepancy,
          repair: result.repair,
          shopId: profile.shopId,
          amuId: profile.amuId,
          technician_name: profile.name,
          man_number: profile.man_number,
          shift: 'Days' as ShiftType,
          timestamp: serverTimestamp(),
          isDemo: isDemoMode,
          isRedBall: false
        }));

        if (isDemoMode) {
          const mockEntries = batch.map((b, i) => ({
            id: `bulk-mock-${Date.now()}-${i}`,
            ...b
          } as MaintenanceLog));
          setLogs(prev => [...mockEntries, ...prev]);
        } else {
          for (const entry of batch) {
            await addDoc(collection(db, 'logs'), entry);
          }
        }
        alert(`Successfully imported ${results.length} entries.`);
      } else {
        alert("No clear maintenance entries found in the image. Please try a clearer picture of the logbook.");
      }
    } catch (error) {
      console.error("Bulk scanning failed:", error);
      handleFirestoreError(error, OperationType.CREATE, 'logs/bulk');
    } finally {
      setIsBulkScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleG081Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsG081Uploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, g081Photo: reader.result as string }));
      setIsG081Uploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert('Operational entries must be assigned to a specific AMU and Shop. Please select a specific assignment in the sidebar before submitting.');
      return;
    }
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
          g081_photo: formData.g081Photo || null,
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
          isDemo: isDemoMode,
          g081_photo: formData.g081Photo || null,
          g081_status: formData.g081Photo ? 'pending' : undefined
        };
        const docRef = await addDoc(collection(db, 'logs'), newLog);

        if (formData.isRedBall && !isDemoMode) {
          await createNotification({
            shopId: profile.shopId,
            type: 'red-ball',
            title: 'RED BALL ALERT',
            message: `${formData.tail_number}: ${formData.discrepancy.slice(0, 50)}...`,
            metadata: { logId: docRef.id, tail_number: formData.tail_number }
          });
        }
      }
      setIsModalOpen(false);
      setEditingLogId(null);
      setFormData({ tail_number: '', jcn: '', discrepancy: '', repair: '', doc_number: '', personnelInput: '', isRedBall: false, shift: 'Days', g081Photo: '' });
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
      shift: log.shift || 'Days',
      g081Photo: log.g081_photo || ''
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 flex items-center justify-center">
            <img 
              src="https://media.defense.gov/2022/Sep/29/2003087437/-1/-1/0/220929-F-AFHRA-020.JPG" 
              alt="92nd AMXS" 
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply' }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">Maintenance Logs</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="tech-label text-primary font-bold">92ND AMXS</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <p className="serif-header text-sm text-slate-500 italic">Operational Readiness & Discrepancy Tracking</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* View Toggle */}
          <div className="flex bg-white border border-outline p-1.5 shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 transition-all", viewMode === 'grid' ? "bg-primary text-white" : "text-slate-400 hover:text-slate-900")}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 transition-all", viewMode === 'list' ? "bg-primary text-white" : "text-slate-400 hover:text-slate-900")}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="h-10 w-px bg-outline mx-2 hidden md:block"></div>

          {/* Action Group */}
          <div className="flex items-center gap-3 flex-1 md:flex-none">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="sleek-button flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" /> 
              <span className="font-black tracking-widest text-[11px] uppercase">New Entry</span>
            </button>

            <div className="relative">
              <button 
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className={cn(
                  "h-[48px] px-4 flex items-center gap-2 border-2 transition-all bg-white font-black text-[10px] tracking-[0.2em] uppercase",
                  isActionsOpen ? "border-primary text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <MoreVertical className="w-4 h-4" />
                <span className="hidden sm:inline">Management</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isActionsOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isActionsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsActionsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-white border border-outline shadow-2xl z-20 flex flex-col divide-y divide-outline"
                    >
                      <div className="p-4 bg-putty/20">
                        <span className="tech-label !text-[8px] text-primary">Shift Operations</span>
                      </div>
                      
                      <button 
                        onClick={() => {
                          exportTurnoverToPDF(logs, difm, profile?.shopId || 'ALL', profile?.amuId || 'ALL', 'Current');
                          setIsActionsOpen(false);
                        }}
                        className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-none bg-sidebar flex items-center justify-center">
                          <HistoryIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-black text-[10px] tracking-widest uppercase">Turnover Report</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Generate shift handover PDF</p>
                        </div>
                      </button>

                      <div className="p-4 bg-putty/20">
                        <span className="tech-label !text-[8px] text-primary">Data Import & Export</span>
                      </div>

                      <button 
                        onClick={() => {
                          bulkScanInputRef.current?.click();
                          setIsActionsOpen(false);
                        }}
                        className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-none bg-putty flex items-center justify-center">
                          <UploadCloud className="w-4 h-4 text-slate-700" />
                        </div>
                        <div>
                          <p className="font-black text-[10px] tracking-widest uppercase truncate">Bulk Logbook Scan</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Batch OCR from photos</p>
                        </div>
                      </button>

                      <div className="grid grid-cols-2">
                        <button 
                          onClick={() => exportLogsToCSV(filteredLogs, profile?.shopId || 'ALL')}
                          className="p-4 hover:bg-slate-50 flex flex-col items-center gap-2 border-r border-outline"
                        >
                          <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                          <span className="font-black text-[9px] tracking-widest uppercase">CSV</span>
                        </button>
                        <button 
                          onClick={() => exportLogsToPDF(filteredLogs, profile?.shopId || 'ALL')}
                          className="p-4 hover:bg-slate-50 flex flex-col items-center gap-2"
                        >
                          <FileText className="w-5 h-5 text-slate-400" />
                          <span className="font-black text-[9px] tracking-widest uppercase">PDF</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
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
                  <th className="px-8 py-5">G081</th>
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
                      {log.g081_photo ? (
                        <div className="flex gap-2 items-center">
                          {log.g081_status === 'verified' ? (
                            <div className="w-7 h-7 rounded-none bg-emerald-100 flex items-center justify-center" title="Verified in G081">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-none bg-caution-yellow/10 flex items-center justify-center" title="G081 Proof Uploaded - Pending Review">
                              <Camera className="w-3.5 h-3.5 text-caution-yellow" />
                            </div>
                          )}
                        </div>
                      ) : <span className="tech-label !text-[8px] opacity-20">No Proof</span>}
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
                    {log.g081_photo && (
                      <div className={cn(
                        "badge flex items-center gap-1.5 ml-2",
                        log.g081_status === 'verified' ? "bg-emerald-50 text-emerald-600" : "bg-caution-yellow/10 text-caution-yellow"
                      )}>
                        {log.g081_status === 'verified' ? <ShieldCheck className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                        <span className="uppercase tracking-widest text-[8px]">{log.g081_status === 'verified' ? 'G081' : 'Upload'}</span>
                      </div>
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

                {selectedLog.g081_photo && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="tech-label">G081 Screen Proof</span>
                      {selectedLog.g081_status === 'verified' && (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="tech-label !text-emerald-600">Verified by {selectedLog.g081_verified_by}</span>
                        </div>
                      )}
                    </div>
                    <div className="border border-outline p-2 bg-putty/10">
                      <img src={selectedLog.g081_photo} alt="G081 Proof" className="w-full h-auto max-h-96 object-contain" />
                    </div>
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
              className="bg-white max-w-2xl w-full max-h-[90vh] rounded-none shadow-2xl flex flex-col border border-outline"
            >
              <div className="p-8 border-b border-outline flex justify-between items-center bg-putty/30 shrink-0">
                <h3 className="font-black text-2xl tracking-tighter uppercase">{editingLogId ? 'Edit Maintenance Entry' : 'New Maintenance Entry'}</h3>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    ref={scanInputRef}
                    className="hidden" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleScan}
                  />
                  <button 
                    type="button"
                    onClick={() => scanInputRef.current?.click()}
                    className="sleek-button bg-primary !text-white flex items-center gap-2 py-2"
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Scan Form</span>
                  </button>
                  <button onClick={() => { setIsModalOpen(false); setEditingLogId(null); }} className="p-2 hover:bg-putty transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 custom-scrollbar">
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

                <div className="space-y-4">
                  <label className="tech-label !text-[9px]">G081 Screen Proof (Optional)</label>
                  <input 
                    type="file" 
                    ref={g081InputRef}
                    className="hidden" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleG081Upload}
                  />
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => g081InputRef.current?.click()}
                      className="sleek-button bg-surface border border-outline hover:bg-slate-50 flex items-center justify-center gap-3 px-6 py-3 flex-1 text-slate-700"
                      disabled={isG081Uploading}
                    >
                      {isG081Uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                      <span className="font-black text-[10px] tracking-widest uppercase">{editingLogId ? 'Update G081 Proof' : 'Upload G081 Proof'}</span>
                    </button>
                    {formData.g081Photo && (
                      <button 
                        type="button" 
                        onClick={() => setFormData({...formData, g081Photo: ''})}
                        className="p-3 text-safety-orange hover:bg-safety-orange/10 rounded-none border border-safety-orange/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {formData.g081Photo && (
                    <div className="mt-2 relative group overflow-hidden border border-outline bg-putty/20 p-2">
                       <img src={formData.g081Photo} alt="G081 Proof" className="max-h-40 w-full object-cover" />
                       <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="tech-label !text-white !opacity-100">Image Loaded</span>
                       </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="sleek-button w-full flex items-center justify-center gap-4 py-4 text-base"
                >
                  {loading ? 'Transmitting Data...' : 'Submit Operational Entry'} <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const G081Gallery: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    
    // In demo mode, we just show empty or mock data
    if (isDemoMode) {
      setLogs([]);
      setLoading(false);
      return;
    }

    // Query for all logs with photos
    // Note: We might need an index for this. If it fails, we'll fall back to broader query.
    const q = query(
      collection(db, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Filter in memory for photos to avoid immediate index requirement
      setLogs(allLogs.filter(log => log.g081_photo));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });
    return unsubscribe;
  }, [profile, isDemoMode]);

  const handleVerify = async (logId: string) => {
    if (isDemoMode) {
      alert('Action not available in demo mode.');
      return;
    }
    try {
      await updateDoc(doc(db, 'logs', logId), {
        g081_status: 'verified',
        g081_verified_by: profile?.name,
        g081_verified_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logs');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 flex items-center justify-center">
            <img 
              src="https://media.defense.gov/2022/Sep/29/2003087437/-1/-1/0/220929-F-AFHRA-020.JPG" 
              alt="92nd AMXS" 
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply' }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">G081 Gallery</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="tech-label text-primary font-bold">92ND AMXS</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <p className="serif-header text-sm text-slate-500 italic">Work Proof Verification & Reaction Board</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white border border-outline border-dashed">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="tech-label">Scanning for Evidence...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white border border-outline border-dashed">
          <Camera className="w-12 h-12 text-slate-200" />
          <p className="tech-label opacity-40">No G081 Proofs Found in Recent Logs</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {logs.map((log) => (
              <motion.div 
                key={log.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white border border-outline overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col"
              >
                <div className="relative aspect-video bg-slate-100 overflow-hidden cursor-zoom-in" onClick={() => setSelectedPhoto(log.g081_photo || null)}>
                  <img 
                    src={log.g081_photo} 
                    alt={`G081 Proof for ${log.tail_number}`} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-10 h-10 text-white" />
                  </div>
                  {log.g081_status === 'verified' && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 flex items-center gap-2 shadow-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-black text-[10px] tracking-widest uppercase">Verified</span>
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-xl tracking-tighter uppercase text-slate-900">{log.tail_number}</h3>
                        <p className="tech-label text-slate-400 !text-[8px] mt-1">{log.technician_name} • {format(log.timestamp?.toDate ? log.timestamp.toDate() : new Date(), 'MMM dd, HH:mm')}</p>
                      </div>
                      <span className="px-2 py-1 bg-putty text-[9px] font-black uppercase tracking-widest">{log.shopId}</span>
                    </div>

                    <div className="p-3 bg-slate-50 border-l-2 border-slate-200">
                      <p className="text-xs text-slate-600 line-clamp-2 italic">"{log.discrepancy}"</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-outline flex items-center justify-between">
                    {log.g081_status === 'verified' ? (
                      <div className="flex items-center gap-3 text-emerald-600">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="tech-label !text-emerald-600 uppercase">Verified G081 Good</span>
                          <span className="text-[9px] text-emerald-600/60 font-medium">By {log.g081_verified_by}</span>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleVerify(log.id!)}
                        className="sleek-button w-full bg-sidebar !text-white flex items-center justify-center gap-3 py-3 group hover:scale-[1.02]"
                      >
                        <Check className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="font-black text-[11px] tracking-widest uppercase text-white">React: G081 Good</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stealth/95 backdrop-blur-xl">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="relative max-w-5xl w-full h-full flex flex-col"
             >
                <button 
                  onClick={() => setSelectedPhoto(null)} 
                  className="absolute top-0 right-0 p-4 text-white hover:text-primary z-[120]"
                >
                  <X className="w-10 h-10" />
                </button>
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  <img src={selectedPhoto} alt="Fullscreen Evidence" className="max-w-full max-h-full object-contain shadow-2xl" />
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DIFMLogs: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<DIFMLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tail_number: '',
    discrepancy: '',
    doc_number: '',
    nsn: '',
    status: 'due-in' as const,
    pipeline_status: 'ordered' as const
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    if (isDemoMode) {
      const isLeadership = profile.role === 'leadership';
      const filteredMockDifm = MOCK_DIFM.filter(log => {
        if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
        if (profile.amuId !== 'ALL' && log.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && log.shopId !== profile.shopId) return false;
        return true;
      });
      setLogs(filteredMockDifm);
      return;
    }

    let q;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL' || profile.role === 'leadership') {
      let queryRef = collection(db, 'difm');
      const constraints: any[] = [];
      
      // If leadership/ncoic but they chose a specific filter
      if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        constraints.push(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        constraints.push(where('shopId', '==', profile.shopId));
      }

      q = query(queryRef, ...constraints);
    } else {
      q = query(
        collection(db, 'difm'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'difm');
    });
    return unsubscribe;
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert('DIFM tracks must be assigned to a specific AMU and Shop. Please select a specific assignment in the sidebar before initiating.');
      return;
    }

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
      setFormData({ 
        tail_number: '', 
        discrepancy: '', 
        doc_number: '', 
        nsn: '', 
        status: 'due-in', 
        pipeline_status: 'ordered' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'difm');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<DIFMLog>) => {
    try {
      const docRef = doc(db, 'difm', id);
      await updateDoc(docRef, updates);

      if (updates.pipeline_status === 'received' && !isDemoMode) {
        const log = logs.find(l => l.id === id);
        if (log) {
          await createNotification({
            shopId: profile?.shopId || 'ALL',
            type: 'parts',
            title: 'PART RECEIVED',
            message: `${log.tail_number}: ${log.nsn || log.discrepancy.slice(0, 30)} is now RECEIVED.`,
            metadata: { difmId: id, tail_number: log.tail_number }
          });
        }
      }
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

  const seedMockData = () => {
    const statusOptions: DIFMLog['status'][] = ['due-in', 'awaiting-parts', 'in-repair'];
    const pOptions: DIFMLog['pipeline_status'][] = ['ordered', 'en-route', 'received'];
    const newLogs: DIFMLog[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `new-mock-${Date.now()}-${i}`,
      tail_number: `AF-92-0${500 + i}`,
      discrepancy: `MOCK: Critical component required for JCN ${24000 + i}`,
      doc_number: `F${12000 + i}A`,
      nsn: `5995-01-999-${1000 + i}`,
      status: statusOptions[Math.floor(Math.random() * statusOptions.length)],
      pipeline_status: pOptions[Math.floor(Math.random() * pOptions.length)],
      shopId: profile?.shopId || 'AVIONICS',
      amuId: profile?.amuId || 'BLACK',
      technician_name: profile?.name || 'DEMO ADMIN',
      timestamp: { toDate: () => new Date() } as any,
      isDemo: true
    }));
    setLogs(prev => [...newLogs, ...prev]);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">DIFM Oversight</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Due-In From Maintenance status and discrepancy tracking</p>
        </div>
        <div className="flex flex-wrap gap-4">
          {isDemoMode && (
            <button 
              onClick={seedMockData}
              className="sleek-button bg-surface border-primary text-primary hover:bg-primary/5 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Seed Mocks
            </button>
          )}
          <button 
            onClick={() => exportTurnoverToPDF([], logs, profile?.shopId || 'ALL', profile?.amuId || 'ALL', 'Current')}
            className="sleek-button bg-sidebar \!text-white border border-white/10 hover:bg-slate-800 flex items-center gap-2"
          >
            <HistoryIcon className="w-4 h-4 text-white" /> Turnover
          </button>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="sleek-button flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Track
          </button>
        </div>
      </div>

      <div className="visible-grid bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                <th className="px-8 py-5">Track Details</th>
                <th className="px-8 py-5 text-center">Logistics Status</th>
                <th className="px-8 py-5">Pipeline Phase</th>
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
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 rounded-none border border-outline">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-black text-sm tracking-tight uppercase text-slate-900">{log.tail_number}</p>
                        <p className="tech-label text-[10px] mt-1 text-slate-500 font-bold uppercase">{log.doc_number || "NO DOC #"}</p>
                        <p className="serif-header text-[10px] text-slate-400 mt-2 max-w-xs">{log.discrepancy}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <select 
                      value={log.status}
                      onChange={(e) => handleUpdate(log.id!, { status: e.target.value as any })}
                      className={cn(
                        "badge cursor-pointer appearance-none text-center min-w-[140px] mx-auto",
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
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-2">
                      <select 
                        value={log.pipeline_status || 'ordered'}
                        onChange={(e) => handleUpdate(log.id!, { pipeline_status: e.target.value as any })}
                        className="tech-label !text-[9px] bg-white border border-outline px-2 py-1 uppercase font-black"
                      >
                        <option value="ordered">ORDERED</option>
                        <option value="en-route">EN-ROUTE</option>
                        <option value="received">RECEIVED</option>
                        <option value="bench-check">BENCH-CHECK</option>
                        <option value="installed">INSTALLED</option>
                      </select>
                      <div className="h-1 bg-slate-100 w-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ 
                            width: (log.pipeline_status === 'ordered' || !log.pipeline_status) ? '20%' :
                                   log.pipeline_status === 'en-route' ? '40%' :
                                   log.pipeline_status === 'received' ? '60%' :
                                   log.pipeline_status === 'bench-check' ? '80%' : '100%' 
                          }}
                        />
                      </div>
                    </div>
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
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-md w-full max-h-[90vh] rounded-none shadow-2xl flex flex-col border border-outline"
            >
              <div className="p-8 border-b border-outline bg-putty/30 flex justify-between items-center shrink-0">
                <h3 className="font-black text-2xl tracking-tighter uppercase">Initiate DIFM Track</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 transition-colors text-slate-900">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <label className="tech-label">Doc Number</label>
                    <input 
                      type="text"
                      value={formData.doc_number}
                      onChange={(e) => setFormData({...formData, doc_number: e.target.value.toUpperCase()})}
                      className="sleek-input w-full uppercase" 
                      placeholder="JCN / DOC #"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="tech-label">NSN / Part Number</label>
                  <input 
                    type="text"
                    value={formData.nsn}
                    onChange={(e) => setFormData({...formData, nsn: e.target.value})}
                    className="sleek-input w-full" 
                    placeholder="National Stock Number or P/N"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="tech-label">Maintenance Discrepancy</label>
                  <textarea 
                    required
                    rows={3}
                    value={formData.discrepancy}
                    onChange={(e) => setFormData({...formData, discrepancy: e.target.value})}
                    className="sleek-input w-full resize-none" 
                    placeholder="Describe the failed component..."
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
            </div>
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
      const isTechnician = profile.role === 'technician';
      
      const filteredMockTraining = MOCK_TRAINING.filter(t => {
        if (isTechnician) return t.man_number === profile.man_number;
        if (profile.amuId !== 'ALL' && t.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && t.shopId !== profile.shopId) return false;
        return true;
      });
      setTraining(filteredMockTraining);

      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (isTechnician) return p.man_number === profile.man_number;
        if (profile.amuId !== 'ALL' && p.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && p.shopId !== profile.shopId) return false;
        return true;
      });
      setPersonnel(filteredMockPersonnel);
      return;
    }

    const isTechnician = profile.role === 'technician';

    let qTraining;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL' || profile.role === 'leadership') {
      let queryRef = collection(db, 'training');
      const constraints: any[] = [where('isDemo', '==', false)];
      
      if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        constraints.push(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        constraints.push(where('shopId', '==', profile.shopId));
      }
      qTraining = query(queryRef, ...constraints);
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
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL' || profile.role === 'leadership') {
      let queryRef = collection(db, 'users');
      const constraints: any[] = [where('isDemo', '==', false)];
      
      if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        constraints.push(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        constraints.push(where('shopId', '==', profile.shopId));
      }
      qPersonnel = query(queryRef, ...constraints);
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
      setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
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

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert('Training reports must be synchronized to a specific AMU and Shop context. Please select a specific assignment in the sidebar before uploading.');
      return;
    }
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
      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (profile.amuId !== 'ALL' && p.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && p.shopId !== profile.shopId) return false;
        return true;
      });
      setPersonnel(filteredMockPersonnel);
      return;
    }

    let q;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL' || profile.role === 'leadership') {
      let queryRef = collection(db, 'users');
      const constraints: any[] = [where('status', '==', 'active'), where('isDemo', '==', false)];
      
      if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        constraints.push(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        constraints.push(where('shopId', '==', profile.shopId));
      }
      q = query(queryRef, ...constraints);
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

const MaintenanceAssistant: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const maintenanceTools: FunctionDeclaration[] = [
    {
      name: "query_maintenance_logs",
      description: "Query aircraft maintenance logs for discrepancies, repairs, and tail number history.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          tail_number: { type: Type.STRING, description: "Filter by specific tail number (e.g. 58-0092)" },
          shift: { type: Type.STRING, enum: ['Days', 'Swings', 'Nights'], description: "Filter by shift" },
          isRedBall: { type: Type.BOOLEAN, description: "If true, only returns urgent red ball maintenance" }
        }
      }
    },
    {
      name: "query_difm_inventory",
      description: "Check status of parts due-in from maintenance (DIFM).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ['due-in', 'awaiting-parts', 'in-repair', 'complete'] },
          tail_number: { type: Type.STRING }
        }
      }
    },
    {
      name: "query_training_compliance",
      description: "Identify technicians with expiring or overdue training requirements.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ['expiring', 'expired'], description: "Filter for specific compliance issues" },
          course_code: { type: Type.STRING, description: "Filter for a specific training course" }
        }
      }
    }
  ];

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
          
          CAPABILITIES:
          - You can query maintenance logs, DIFM inventory, and training compliance data using real-time database functions.
          - Use these tools to provide factual, data-driven answers about squadron readiness.
          
          TONE:
          - Professional, technical, and mission-focused military tone. 
          - Keep responses concise and scannable using tables and bullet points.
          
          FORMATTING:
          - Always use Markdown tables for data.
          - Highlight critical issues (RED BALLS or EXPIRED training) in bold.`,
          tools: [{ functionDeclarations: maintenanceTools }],
          temperature: 0,
        }
      });

      if (response.functionCalls) {
        const toolOutputs: any[] = [];
        
        for (const call of response.functionCalls) {
          let data: any = [];
          
          if (isDemoMode) {
             if (call.name === "query_maintenance_logs") {
               const args = call.args as any;
               data = MOCK_LOGS.filter(l => {
                 if (args.tail_number && l.tail_number !== args.tail_number) return false;
                 if (args.shift && l.shift !== args.shift) return false;
                 if (args.isRedBall && !l.isRedBall) return false;
                 return true;
               }).slice(0, 10);
             } else if (call.name === "query_difm_inventory") {
               const args = call.args as any;
               data = MOCK_DIFM.filter(d => {
                 if (args.status && d.status !== args.status) return false;
                 if (args.tail_number && d.tail_number !== args.tail_number) return false;
                 return true;
               }).slice(0, 10);
             } else if (call.name === "query_training_compliance") {
               const args = call.args as any;
               data = MOCK_TRAINING.filter(t => {
                 if (args.status && t.status !== args.status) return false;
                 if (args.course_code && t.course_code !== args.course_code) return false;
                 return true;
               }).slice(0, 10);
             }
          } else {
             // Real Firestore logic
             const collectionName = call.name === "query_maintenance_logs" ? "logs" : 
                                  call.name === "query_difm_inventory" ? "difm" : "training";
             
             let q = query(collection(db, collectionName), where('shopId', '==', profile?.shopId), limit(20));
             const args = call.args as any;
             
             if (args.tail_number) q = query(q, where('tail_number', '==', args.tail_number));
             if (args.status) q = query(q, where('status', '==', args.status));
             if (args.shift) q = query(q, where('shift', '==', args.shift));

             const snap = await getDocs(q);
             data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }

          toolOutputs.push({
            callId: call.id,
            output: data
          });
        }

        // Send tool outputs back to model to get final response
        const finalResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            { role: 'user', parts: [{ text: userMsg }] },
            { role: 'model', parts: response.candidates[0].content.parts },
            {
              role: 'user',
              parts: toolOutputs.map(o => ({
                functionResponse: {
                  name: response.functionCalls![0].name,
                  response: { result: o.output },
                }
              }))
            }
          ],
          config: {
            systemInstruction: `Analyze the provided data result and summarize it for the maintainer.`,
            temperature: 0,
          }
        });

        if (finalResponse.text) {
          setMessages(prev => [...prev, { role: 'assistant', content: finalResponse.text! }]);
        }
      } else if (response.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
      }
    } catch (err) {
      console.error("AI Assistant Error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "SYSTEM ERROR: Signal interference during operational analysis. Terminal link unstable." }]);
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
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-white tracking-widest">Maintenance Terminal</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-tighter">Secure Link Active // Intelligence Feed</span>
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
                      : "bg-white border border-outline text-slate-900 serif-header shadow-sm markdown-body"
                  )}>
                    {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
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
          "w-14 h-14 rounded-none flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all border-2 backdrop-blur-md relative group",
          isOpen 
            ? "bg-white border-primary text-primary" 
            : "bg-sidebar/95 border-white/20 text-white"
        )}
        title="AI Maintenance Assistant"
      >
        <div className={cn(
          "w-10 h-10 flex items-center justify-center transition-all",
          isOpen ? "bg-primary text-white" : "bg-white/10 text-white group-hover:bg-primary/20"
        )}>
          {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
        </div>

        {/* Technical Label (Hidden by default, shown on hover if needed or just omitted for pure button feel) */}
        <div className="absolute right-full mr-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap hidden md:block">
          <div className="bg-sidebar text-white px-3 py-1.5 border border-white/10 flex flex-col items-end">
            <span className="tech-label !text-[6px] text-primary">AMXS-INTEL</span>
            <span className="font-black text-[9px] uppercase tracking-widest leading-none mt-1">AI Assistant Terminal</span>
          </div>
        </div>

        {/* Status Light */}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 flex">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </div>
        )}
      </motion.button>
    </div>
  );
};

const useProactiveTrainingScan = () => {
  const { profile, isDemoMode } = useAuth();

  useEffect(() => {
    if (!profile || isDemoMode || !(profile.role === 'ncoic' || profile.role === 'leadership')) return;

    const scanTraining = async () => {
      try {
        const now = new Date();
        const thirtyDaysFromNow = addDays(now, 30);
        
        // Scan for training in our shop due within 30 days
        const q = query(
          collection(db, 'training'),
          where('amuId', '==', profile.amuId),
          where('shopId', '==', profile.shopId),
          where('isDemo', '==', isDemoMode),
          where('status', 'in', ['current', 'expiring'])
        );

        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const data = d.data() as TrainingRecord;
          const dueDate = parseISO(data.due_date);
          
          if (isBefore(dueDate, thirtyDaysFromNow)) {
             // Create a notification for the NCOIC if one doesn't exist for this specific record today
             // Optimized with local storage to avoid spamming
             const storageKey = `training-notif-${d.id}-${format(now, 'yyyy-MM-dd')}`;
             if (!localStorage.getItem(storageKey)) {
                await createNotification({
                  shopId: profile.shopId,
                  type: 'training',
                  title: 'TRAINING COMPLIANCE ALERT',
                  message: `Task ${data.course_name} for Man# ${data.man_number} expires in <30 days (${data.due_date})`,
                  metadata: { trainingId: d.id, man_number: data.man_number }
                });
                localStorage.setItem(storageKey, 'sent');
             }
          }
        }
      } catch (e) {
        console.error("Training scan failed", e);
      }
    };

    scanTraining();
    const interval = setInterval(scanTraining, 3600000); // Scan every hour
    return () => clearInterval(interval);
  }, [profile, isDemoMode]);
};

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  
  // Proactive compliance monitoring
  useProactiveTrainingScan();

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
        <Route path="/g081" element={<G081Gallery />} />
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