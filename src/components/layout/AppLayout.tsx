import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePresence } from '../../hooks/usePresence';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../../services/notificationService';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, profile, isDemoMode } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [isAMUDropdownOpen, setIsAMUDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();

  // Presence logic
  const activeUsers = usePresence(location.pathname);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      createNotification({
        type: 'system',
        userId: user?.uid,
        shopId: profile?.shopId || 'ALL',
        title: 'Network Restored',
        message: 'System link re-established. All local shifts and maintenance logs are being synchronized with the main frame.',
        isDemo: isDemoMode
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      createNotification({
        type: 'system',
        userId: user?.uid,
        shopId: profile?.shopId || 'ALL',
        title: 'Working Offline',
        message: 'Network link severed. Operational data will be buffered locally and committed once connectivity is restored.',
        isDemo: isDemoMode
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.uid, profile?.shopId, isDemoMode]);

  useEffect(() => {
    const onTourSidebar = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      setIsSidebarOpen(Boolean(detail?.open));
    };
    window.addEventListener('amxs-tour-sidebar', onTourSidebar);
    return () => window.removeEventListener('amxs-tour-sidebar', onTourSidebar);
  }, []);

  return (
    <div className="min-h-screen flex bg-background relative">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isRoleDropdownOpen={isRoleDropdownOpen}
        setIsRoleDropdownOpen={setIsRoleDropdownOpen}
        isAMUDropdownOpen={isAMUDropdownOpen}
        setIsAMUDropdownOpen={setIsAMUDropdownOpen}
        isShopDropdownOpen={isShopDropdownOpen}
        setIsShopDropdownOpen={setIsShopDropdownOpen}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <TopBar 
          activeUsers={activeUsers}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        <div className="flex-1 px-8 pb-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
