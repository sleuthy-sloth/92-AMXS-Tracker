import { useEffect, useRef } from 'react';
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
import { useAuth } from '../contexts/AuthContextInstance';
import { useScanStatus } from '../contexts/AIScanStatusInstance';
import { createNotification } from '../services/notificationService';
import { MaintenanceLog } from '../types';
import { tsToMillis } from '../lib/utils';
import { isGenAIMilConfigured } from '../lib/gemini';
import { SupplyRiskListSchema } from '../lib/aiSchemas';
import { generateJSONWithFallback, isOpenRouterConfigured } from '../lib/aiProvider';
import {
  getCachedAIResultStaleOk,
  setCachedAIResult,
  generateDataHash,
  acquireCacheLock,
  releaseCacheLock,
  generateSessionId,
} from '../lib/aiCache';
import { classifyError, AIRetryError } from '../lib/aiRetry';

const WINDOW_DAYS = 7;
const SCAN_CAP = 25;
const CACHE_TTL_MS = 14400000; // 4 hours
const LOCK_KEY_PREFIX = 'supply-risk';

export const useSupplyRiskScan = () => {
  const { profile, isDemoMode } = useAuth();
  const { reportStart, reportSuccess, reportError } = useScanStatus();
  const sessionRef = useRef<string>(generateSessionId());

  useEffect(() => {
    if (!profile || isDemoMode) return;
    if (!(profile.role === 'ncoic' || profile.role === 'leadership')) return;
    if (!isGenAIMilConfigured() && !isOpenRouterConfigured()) return;

    const cacheKey = `${profile.amuId}_${profile.shopId}`;
    let cancelled = false;

    const scan = async () => {
      // ── Step 1: Read cache stale-ok ──────────────────────────────────
      type SupplyRiskParsed = {
        logId: string;
        tail_number: string;
        risk: 'high' | 'medium' | 'low';
        likely_parts: string[];
        rationale: string;
      };

      const cached = await getCachedAIResultStaleOk<SupplyRiskParsed[]>(
        LOCK_KEY_PREFIX,
        cacheKey,
        CACHE_TTL_MS
      );

      if (cancelled) return;

      // ── Step 2: If cache is fresh, done ─────────────────────────────
      if (cached.exists && cached.age < CACHE_TTL_MS) {
        reportSuccess(LOCK_KEY_PREFIX);
        return;
      }

      // ── Step 3: Attempt distributed lock for background refresh ──────
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

      if (cancelled) return;

      if (candidates.length === 0) {
        reportSuccess(LOCK_KEY_PREFIX);
        return;
      }

      const summary = candidates
        .slice(0, 15)
        .map((l) => `${l.id}|${l.tail_number}: ${l.discrepancy}`)
        .join('\n');

      const currentHash = generateDataHash([summary]);
      const lockAcquired = await acquireCacheLock(
        `${LOCK_KEY_PREFIX}_${cacheKey}`,
        sessionRef.current
      );

      if (cancelled) return;

      if (!lockAcquired) {
        // Another client is refreshing — use stale data
        return;
      }

      // ── Step 4: We hold the lock — generate fresh analysis ──────────
      reportStart(LOCK_KEY_PREFIX);

      try {
        let parsed: SupplyRiskParsed[] | null = cached.data || null;
        let finalSource: 'genai-mil' | 'openrouter' = 'genai-mil';

        if (!cached.exists || cached.age >= CACHE_TTL_MS) {
          const { data, source } = await generateJSONWithFallback({
            schema: SupplyRiskListSchema,
            context: 'SupplyRiskScan',
            prompt: `SYSTEM: 92nd AMXS supply-chain risk classifier.
  DATA (open discrepancies, id|tail: text):
  ${summary}

  TASK: For each entry that is LIKELY to require supply parts (NSN, kit, LRU), output one finding. Skip entries that are operator adjustments or soft-fault resets.
  CONSTRAINT: Use only ids present in DATA. Do not invent.
  OUTPUT JSON: [{"logId","tail_number","risk":"high|medium|low","likely_parts":[string],"rationale"}]`,
          });
          parsed = data as SupplyRiskParsed[] | null;
          finalSource = source as 'genai-mil' | 'openrouter';

          if (data) {
            await setCachedAIResult(LOCK_KEY_PREFIX, cacheKey, data, currentHash);
          }
        }

        if (!parsed) {
          reportError(
            LOCK_KEY_PREFIX,
            { kind: 'parse', message: 'AI response failed schema validation', retryable: false },
            finalSource
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
        reportSuccess(LOCK_KEY_PREFIX, finalSource);
      } catch (err) {
        console.error('Supply risk scan failed', err);
        const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
        reportError(LOCK_KEY_PREFIX, classified);
        await createNotification({
          shopId: profile.shopId,
          amuId: profile.amuId,
          type: 'system',
          title: 'Supply Risk Scan Failed',
          message: `Background scan could not complete (${classified.kind}). Data may be stale.`,
          metadata: { kind: classified.kind },
        });
      } finally {
        await releaseCacheLock(`${LOCK_KEY_PREFIX}_${cacheKey}`, sessionRef.current);
      }
    };

    // Run once on mount (with delay to avoid startup contention)
    const timeout = setTimeout(scan, 15000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [profile, isDemoMode, reportStart, reportSuccess, reportError]);
};
