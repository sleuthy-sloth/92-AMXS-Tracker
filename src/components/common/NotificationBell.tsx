import React, { useState, useEffect, useRef } from 'react';
import { query, collection, where, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Bell, BellDot, ShieldAlert, Package, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { Notification, NotificationType } from '../../types';
import { cn } from '../../lib/utils';

export const NotificationBell: React.FC = () => {
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
  }, [user, profile, isDemoMode]);

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
        className="relative p-2.5 bg-slate-100 hover:bg-slate-200 transition-colors border border-outline group"
        title="Operational Alerts"
      >
        {unreadCount > 0 ? (
          <>
            <BellDot className="w-5 h-5 text-primary" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-black flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
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
