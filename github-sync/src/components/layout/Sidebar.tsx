import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  LayoutDashboard,
  Wrench,
  BarChart3,
  Users,
  HelpCircle,
  UserPlus,
  ClipboardList,
  Gauge,
  Stethoscope,
  Shield,
  X,
  PlayCircle,
  LucideIcon
} from 'lucide-react';
import { useContext } from 'react';
import { TourContext } from '../../contexts/TourContext';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { AMUS, SHOPS, ShopType } from '../../mockData';
import { AMUType, UserRole } from '../../types';
import { cn } from '../../lib/utils';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isRoleDropdownOpen: boolean;
  setIsRoleDropdownOpen: (open: boolean) => void;
  isAMUDropdownOpen: boolean;
  setIsAMUDropdownOpen: (open: boolean) => void;
  isShopDropdownOpen: boolean;
  setIsShopDropdownOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isRoleDropdownOpen,
  setIsRoleDropdownOpen,
  isAMUDropdownOpen,
  setIsAMUDropdownOpen,
  isShopDropdownOpen,
  setIsShopDropdownOpen
}) => {
  const { profile, isDemoMode, toggleDemoMode, setRole, setAMU, setShop } = useAuth();
  const location = useLocation();
  const tour = useContext(TourContext);

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Operations', path: '/ops', icon: Wrench },
    { name: 'Training Tracker', path: '/training', icon: BarChart3 },
    { name: 'Personnel', path: '/personnel', icon: Users },
    { name: 'Handoff', path: '/handoff', icon: ClipboardList },
    { name: 'Support', path: '/support', icon: HelpCircle },
  ];

  const adminItems: NavItem[] = [
    { name: 'Diagnostics', path: '/diagnostics', icon: Stethoscope },
    { name: 'Workload', path: '/workload', icon: Gauge },
    { name: 'Onboarding', path: '/onboarding', icon: UserPlus },
  ];

  const isAdminRole = profile?.role === 'ncoic' || profile?.role === 'leadership';
  const isOnAdminRoute = adminItems.some(i => location.pathname === i.path);
  const [isAdminOpen, setIsAdminOpen] = useState(isOnAdminRoute);

  // Route → panel sync: auto-expand the admin section when the active route
  // becomes an admin page (direct URL, nav links, browser back/forward).
  // The user can still manually collapse via the Admin button; this only
  // re-opens on a transition *into* an admin route.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOnAdminRoute) setIsAdminOpen(true);
  }, [isOnAdminRoute]);

  const isNavItemActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 w-[260px] bg-sidebar text-white transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col border-r border-white/10 overflow-y-auto",
      isSidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Mobile Close Button */}
      <button 
        onClick={() => setIsSidebarOpen(false)}
        className="md:hidden absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

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

          {isAdminRole && (
          <>
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
          </>
          )}
        </div>
      )}

      <nav className="flex-grow px-4 py-8 space-y-1" data-tour="sidebar-nav">
        <p className="tech-label text-white/40 px-4 mb-4">Operations</p>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all",
              isNavItemActive(item.path)
                ? "bg-white/10 text-primary border-r-2 border-primary"
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.name}
          </Link>
        ))}

        {isAdminRole && (
          <div className="pt-4">
            <button
              onClick={() => setIsAdminOpen(!isAdminOpen)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all",
                isOnAdminRoute
                  ? "bg-white/10 text-primary border-r-2 border-primary"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
              <ChevronDown className={cn("ml-auto w-3 h-3 transition-transform", isAdminOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isAdminOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pl-4 space-y-1 mt-1">
                    {adminItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all",
                          location.pathname === item.path
                            ? "bg-white/10 text-primary border-r-2 border-primary"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
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
          {isDemoMode && tour && (
            <button
              onClick={tour.restartTour}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-[10px] font-black tracking-widest uppercase"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Restart Tour
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
