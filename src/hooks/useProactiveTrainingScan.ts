import { useEffect } from 'react';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { format, addDays, parseISO, isBefore } from 'date-fns';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotification } from '../services/notificationService';
import { TrainingRecord } from '../types';

export const useProactiveTrainingScan = () => {
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
          // We don't filter by isDemo here because we want to alert on the actual shop's data
          // if it's not in demo mode. 
          where('isDemo', '==', false), 
          where('status', 'in', ['current', 'expiring'])
        );

        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const data = d.data() as TrainingRecord;
          const dueDate = parseISO(data.due_date);
          
          if (isBefore(dueDate, thirtyDaysFromNow)) {
             // Create a notification for the NCOIC if one doesn't exist for this specific record today
             const storageKey = `training-notif-${d.id}-${format(now, 'yyyy-MM-dd')}`;
             if (!localStorage.getItem(storageKey)) {
                await createNotification({
                  shopId: profile.shopId,
                  amuId: profile.amuId,
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

    // Initial scan after a short delay
    const timeout = setTimeout(scanTraining, 5000);
    const interval = setInterval(scanTraining, 3600000); // Scan every hour
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [profile, isDemoMode]);
};
