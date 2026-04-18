import React from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Wrench, FileDown, Camera, BarChart3, Users, HelpCircle, UserPlus, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../common/NotificationBell';
import { PresenceIndicator } from '../common/PresenceIndicator';
import { UserPresence } from '../../types';

interface TopBarProps {
  activeUsers: UserPresence[];
  setIsSidebarOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeUsers, setIsSidebarOpen }) => {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Maintenance Log', path: '/maintenance', icon: Wrench },
    { name: 'DIFM Log', path: '/difm', icon: FileDown },
    { name: 'G081 Gallery', path: '/g081', icon: Camera },
    { name: 'Training Tracker', path: '/training', icon: BarChart3 },
    { name: 'Personnel', path: '/personnel', icon: Users },
    { name: 'Support', path: '/support', icon: HelpCircle },
    { name: 'Onboarding', path: '/onboarding', icon: UserPlus },
  ];

  const currentPathName = navItems.find(i => i.path === location.pathname)?.name || 'Dashboard';

  return (
    <header className="flex justify-between items-start p-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden p-2 bg-slate-100 hover:bg-slate-200 transition-colors border border-outline"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{currentPathName}</h1>
          <p className="text-slate-600 text-sm">92nd Aircraft Maintenance Squadron • Fairchild AFB</p>
        </div>
      </div>
      
      <div className="text-right hidden sm:flex items-start gap-10">
        <div className="flex items-center gap-6">
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
