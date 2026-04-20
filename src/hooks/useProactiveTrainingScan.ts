import { useEffect } from 'react';
import { query, collection, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { format, addDays, parseISO, isBefore } from 'date-fns';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContextInstance';
import { useScanStatus } from '../contexts/AIScanStatusInstance';
import { createNotification } from '../services/notificationService';
import { TrainingRecord } from '../types';
import { classifyError } from '../lib/aiRetry';

export const useProactiveTrainingScan = () => {
  const { profile, isDemoMode } = useAuth();
  const { reportStart, reportSuccess, reportError } = useScanStatus();

  useEffect(() => {
    if (!profile || isDemoMode || !(profile.role === 'ncoic' || profile.role === 'leadership')) return;

    const scanTraining = async () => {
      reportStart('training');
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
             // Server-side dedup: one notification per (user, training record, day).
             // Keys off profile.uid so different NCOICs scanning the same shop
             // don't double-notify each other — and works across devices unlike
             // the previous localStorage approach.
             const dedupKey = `${profile.uid}_${d.id}_${format(now, 'yyyy-MM-dd')}`;
             const dedupRef = doc(db, 'training_notifications_dedup', dedupKey);
             const existing = await getDoc(dedupRef);
             if (!existing.exists()) {
                await createNotification({
                  shopId: profile.shopId,
                  amuId: profile.amuId,
                  type: 'training',
                  title: 'TRAINING COMPLIANCE ALERT',
                  message: `Task ${data.course_name} for Man# ${data.man_number} expires in <30 days (${data.due_date})`,
                  metadata: { trainingId: d.id, man_number: data.man_number }
                });
                await setDoc(dedupRef, {
                  userId: profile.uid,
                  trainingId: d.id,
                  sentAt: serverTimestamp(),
                });
             }
          }
        }
        reportSuccess('training');
      } catch (e) {
        console.error("Training scan failed", e);
        const classified = classifyError(e);
        reportError('training', classified);
        await createNotification({
          shopId: profile.shopId,
          amuId: profile.amuId,
          type: 'system',
          title: 'Training Scan Failed',
          message: `Background compliance scan could not complete (${classified.kind}). Data may be stale.`,
          metadata: { kind: classified.kind },
        });
      }
    };

    // Initial scan after a short delay
    const timeout = setTimeout(scanTraining, 5000);
    const interval = setInterval(scanTraining, 3600000); // Scan every hour
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [profile, isDemoMode, reportStart, reportSuccess, reportError]);
};
