import React from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Wrench, FileDown, Camera, BarChart3, Users, HelpCircle, UserPlus, Menu, ClipboardList, Stethoscope, Gauge, PlayCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../common/NotificationBell';
import { PresenceIndicator } from '../common/PresenceIndicator';
import { SyncStatus } from '../common/SyncStatus';
import { UserPresence } from '../../types';
import { TourContext } from '../../contexts/TourContext';

interface TopBarProps {
  activeUsers: UserPresence[];
  setIsSidebarOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeUsers, setIsSidebarOpen }) => {
  const { profile, logout, isDemoMode } = useAuth();
  const tour = React.useContext(TourContext);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Maintenance Log', path: '/ops/maintenance', icon: Wrench },
    { name: 'DIFM Log', path: '/ops/difm', icon: FileDown },
    { name: 'G081 Gallery', path: '/ops/g081', icon: Camera },
    { name: 'Training Tracker', path: '/training', icon: BarChart3 },
    { name: 'Personnel', path: '/personnel', icon: Users },
    { name: 'Shift Handoff', path: '/handoff', icon: ClipboardList },
    { name: 'Support', path: '/support', icon: HelpCircle },
    { name: 'Diagnostics', path: '/diagnostics', icon: Stethoscope },
    { name: 'Workload', path: '/workload', icon: Gauge },
    { name: 'Onboarding', path: '/onboarding', icon: UserPlus },
  ];

  const currentPathName =
    navItems.find(i => i.path === location.pathname)?.name ||
    (location.pathname === '/ops' ? 'Maintenance Log' : 'Dashboard');

  return (
    <header className="flex justify-between items-start p-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden p-2 bg-slate-100 hover:bg-slate-200 transition-colors border border-outline"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        {isDemoMode && tour && (
          <button
            onClick={tour.restartTour}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-caution-yellow/10 hover:bg-caution-yellow/20 text-caution-yellow border border-caution-yellow/30 transition-colors text-[10px] font-black tracking-widest uppercase"
            aria-label="Start guided tour"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Tour
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{currentPathName}</h1>
          <p className="text-slate-600 text-sm">92nd Aircraft Maintenance Squadron • Fairchild AFB</p>
        </div>
      </div>
      
      <div className="text-right hidden sm:flex items-start gap-10">
        <div className="flex items-center gap-6">
          <SyncStatus />
          <PresenceIndicator users={activeUsers} />
          <NotificationBell />
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
  );
};
