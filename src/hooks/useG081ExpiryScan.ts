import { useEffect } from 'react';
import {
  query,
  collection,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContextInstance';
import { useScanStatus } from '../contexts/AIScanStatusInstance';
import { createNotification } from '../services/notificationService';
import { MaintenanceLog } from '../types';
import { tsToMillis } from '../lib/utils';
import { classifyError } from '../lib/aiRetry';

const EXPIRY_DAYS = 30;

export const useG081ExpiryScan = () => {
  const { profile, isDemoMode } = useAuth();
  const { reportStart, reportSuccess, reportError } = useScanStatus();

  useEffect(() => {
    if (!profile || isDemoMode) return;
    if (!(profile.role === 'ncoic' || profile.role === 'leadership')) return;

    const scan = async () => {
      reportStart('g081-expiry');
      try {
        const cutoff = subDays(new Date(), EXPIRY_DAYS).getTime();
        const q = query(
          collection(db, 'logs'),
          where('amuId', '==', profile.amuId),
          where('shopId', '==', profile.shopId),
          where('isDemo', '==', false),
          where('g081_status', '==', 'verified')
        );

        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const data = d.data() as MaintenanceLog;
          const verifiedMs = tsToMillis(data.g081_verified_at);
          if (verifiedMs === 0 || verifiedMs > cutoff) continue;

          const today = format(new Date(), 'yyyy-MM-dd');
          const dedupKey = `${profile.uid}_g081_${d.id}_${today}`;
          const dedupRef = doc(db, 'training_notifications_dedup', dedupKey);
          const existing = await getDoc(dedupRef);
          if (existing.exists()) continue;

          await createNotification({
            shopId: profile.shopId,
            amuId: profile.amuId,
            type: 'g081-expiry',
            title: 'G081 VERIFICATION STALE',
            message: `Tail ${data.tail_number} G081 verified > ${EXPIRY_DAYS}d ago. Re-verify entry.`,
            metadata: { logId: d.id, tail_number: data.tail_number },
          });
          await setDoc(dedupRef, {
            userId: profile.uid,
            logId: d.id,
            sentAt: serverTimestamp(),
          });
        }
        reportSuccess('g081-expiry');
      } catch (err) {
        console.error('G081 expiry scan failed', err);
        const classified = classifyError(err);
        reportError('g081-expiry', classified);
        await createNotification({
          shopId: profile.shopId,
          amuId: profile.amuId,
          type: 'system',
          title: 'G081 Expiry Scan Failed',
          message: `Background verification scan could not complete (${classified.kind}). Data may be stale.`,
          metadata: { kind: classified.kind },
        });
      }
    };

    const timeout = setTimeout(scan, 8000);
    const interval = setInterval(scan, 3600000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [profile, isDemoMode, reportStart, reportSuccess, reportError]);
};
