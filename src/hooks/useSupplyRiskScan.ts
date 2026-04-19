import { useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useScanStatus } from '../contexts/AIScanStatusContext';
import { createNotification } from '../services/notificationService';
import { MaintenanceLog } from '../types';
import { tsToMillis } from '../lib/utils';
import { isGeminiConfigured } from '../lib/gemini';
import { SupplyRiskListSchema } from '../lib/aiSchemas';
import { generateJSONWithFallback, isOpenRouterConfigured } from '../lib/aiProvider';
import { classifyError, AIRetryError } from '../lib/aiRetry';

const WINDOW_DAYS = 7;
const SCAN_CAP = 25;

export const useSupplyRiskScan = () => {
  const { profile, isDemoMode } = useAuth();
  const { reportStart, reportSuccess, reportError } = useScanStatus();

  useEffect(() => {
    if (!profile || isDemoMode) return;
    if (!(profile.role === 'ncoic' || profile.role === 'leadership')) return;
    if (!isGeminiConfigured() && !isOpenRouterConfigured()) return;

    const scan = async () => {
      reportStart('supply-risk');
      try {
        const cutoff = subDays(new Date(), WINDOW_DAYS).getTime();
        const qLogs = query(
          collection(db, 'logs'),
          where('amuId', '==', profile.amuId),
          where('shopId', '==', profile.shopId),
          where('isDemo', '==', false),
          orderBy('timestamp', 'desc'),
          limit(SCAN_CAP)
        );
        const snap = await getDocs(qLogs);
        const candidates = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as MaintenanceLog)
          .filter((l) => tsToMillis(l.timestamp) >= cutoff && (!l.repair || l.repair.trim() === ''));

        if (candidates.length === 0) {
          reportSuccess('supply-risk');
          return;
        }

        const summary = candidates
          .slice(0, 15)
          .map((l) => `${l.id}|${l.tail_number}: ${l.discrepancy}`)
          .join('\n');

        const { data: parsed, source } = await generateJSONWithFallback({
          schema: SupplyRiskListSchema,
          context: 'SupplyRiskScan',
          prompt: `SYSTEM: 92nd AMXS supply-chain risk classifier.
DATA (open discrepancies, id|tail: text):
${summary}

TASK: For each entry that is LIKELY to require supply parts (NSN, kit, LRU), output one finding. Skip entries that are operator adjustments or soft-fault resets.
CONSTRAINT: Use only ids present in DATA. Do not invent.
OUTPUT JSON: [{"logId","tail_number","risk":"high|medium|low","likely_parts":[string],"rationale"}]`,
        });

        if (!parsed) {
          reportError(
            'supply-risk',
            { kind: 'parse', message: 'AI response failed schema validation', retryable: false },
            source,
          );
          return;
        }

        const today = format(new Date(), 'yyyy-MM-dd');
        for (const f of parsed) {
          if (!candidates.find((c) => c.id === f.logId)) continue;
          const dedupKey = `${profile.uid}_supply_${f.logId}_${today}`;
          const dedupRef = doc(db, 'training_notifications_dedup', dedupKey);
          const existing = await getDoc(dedupRef);
          if (existing.exists()) continue;

          await createNotification({
            shopId: profile.shopId,
            amuId: profile.amuId,
            type: 'supply-risk',
            title: `SUPPLY RISK: ${f.tail_number}`,
            message: `${f.risk.toUpperCase()} — ${f.rationale}${
              f.likely_parts.length ? ` Parts: ${f.likely_parts.join(', ')}` : ''
            }`,
            metadata: { logId: f.logId, risk: f.risk, parts: f.likely_parts },
          });
          await setDoc(dedupRef, {
            userId: profile.uid,
            logId: f.logId,
            sentAt: serverTimestamp(),
          });
        }
        reportSuccess('supply-risk', source);
      } catch (err) {
        console.error('Supply risk scan failed', err);
        const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
        reportError('supply-risk', classified);
        await createNotification({
          shopId: profile.shopId,
          amuId: profile.amuId,
          type: 'system',
          title: 'Supply Risk Scan Failed',
          message: `Background scan could not complete (${classified.kind}). Data may be stale.`,
          metadata: { kind: classified.kind },
        });
      }
    };

    const timeout = setTimeout(scan, 15000);
    const interval = setInterval(scan, 4 * 3600000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [profile, isDemoMode, reportStart, reportSuccess, reportError]);
};
