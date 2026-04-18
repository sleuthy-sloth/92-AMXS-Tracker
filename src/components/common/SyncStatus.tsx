import React, { useState, useEffect } from 'react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../../firebase';
import { Wifi, WifiOff, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const SyncStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(new Date());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for Firestore sync events
    const unsubscribe = onSnapshotsInSync(db, () => {
      setIsSyncing(false);
      setLastSync(new Date());
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  // We can't easily detect "sync start" from the web SDK directly, 
  // but we can assume syncing whenever the user is online and a write happens.
  // For now, we'll focus on the Online/Offline state and the confirmation of sync.

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-outline rounded-none shadow-sm h-full">
      <AnimatePresence mode="wait">
        {isOnline ? (
          <motion.div 
            key="online"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              {isSyncing && (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-1 -right-1"
                >
                  <RefreshCcw className="w-2 h-2 text-primary" />
                </motion.div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-emerald-600 leading-none">Link Established</span>
              {lastSync && (
                <span className="text-[7px] text-slate-400 font-mono mt-0.5">
                  Last Sync: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
             key="offline"
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.8 }}
             className="flex items-center gap-2"
          >
            <WifiOff className="w-3.5 h-3.5 text-safety-orange animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-safety-orange leading-none">Local Buffer Active</span>
              <span className="text-[7px] text-slate-400 font-mono mt-0.5">Offline Mode</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
