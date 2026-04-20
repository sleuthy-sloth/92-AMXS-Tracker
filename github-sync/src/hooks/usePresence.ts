import { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp, query, collection, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserPresence } from '../types';
import { tsToDate } from '../lib/utils';

export const usePresence = (location: string) => {
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
          const activeAt = tsToDate(u.activeAt);
          return (now.getTime() - activeAt.getTime()) < 120000;
        });
      setActiveUsers(users);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [user, profile, location, isDemoMode]);

  return activeUsers;
};
