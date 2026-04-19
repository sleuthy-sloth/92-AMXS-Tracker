import React, { useEffect, useMemo, useState } from 'react';
import { Stethoscope, RefreshCw, AlertTriangle } from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useScanStatus } from '../contexts/AIScanStatusContext';
import { MaintenanceLog } from '../types';
import { getAI, isGeminiConfigured } from '../lib/gemini';
import { safeParse, DiagnosticsSchema, DiagnosticFindingParsed } from '../lib/aiSchemas';
import { withRetry, classifyError, AIRetryError } from '../lib/aiRetry';
import { cn } from '../lib/utils';

const MAX_LOGS = 60;

export const Diagnostics: React.FC = () => {
  const { profile } = useAuth();
  const { reportStart, reportSuccess, reportError } = useScanStatus();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [findings, setFindings] = useState<DiagnosticFindingParsed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') return;
    const qLogs = query(
      collection(db, 'logs'),
      where('amuId', '==', profile.amuId),
      where('shopId', '==', profile.shopId),
      where('isDemo', '==', false),
      orderBy('timestamp', 'desc'),
      limit(MAX_LOGS)
    );
    return onSnapshot(
      qLogs,
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MaintenanceLog)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'logs')
    );
  }, [profile]);

  const byTail = useMemo(() => {
    const m = new Map<string, MaintenanceLog[]>();
    logs.forEach((l) => {
      const arr = m.get(l.tail_number) ?? [];
      arr.push(l);
      m.set(l.tail_number, arr);
    });
    return Array.from(m.entries())
      .filter(([, v]) => v.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);
  }, [logs]);

  const analyze = async () => {
    if (!profile || !isGeminiConfigured()) {
      setError('Gemini API not configured.');
      return;
    }
    if (byTail.length === 0) {
      setFindings([]);
      setError('No tails with repeat entries to analyze.');
      return;
    }
    setLoading(true);
    setError(null);
    reportStart('diagnostics');
    try {
      const summary = byTail
        .slice(0, 10)
        .map(
          ([tail, items]) =>
            `${tail} (${items.length} entries): ${items
              .map((i) => `"${i.discrepancy}" → "${i.repair || 'no repair'}"`)
              .join(' | ')}`
        )
        .join('\n');

      const response = await withRetry(() => getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `SYSTEM: 92nd AMXS predictive maintenance analyst.
DATA (Shop ${profile.shopId}, AMU ${profile.amuId}):
${summary}

TASK: Identify recurring-component failure patterns per tail. Focus on repeat or related discrepancies that suggest an impending component failure.
CONSTRAINTS: Ground every finding in the data provided. Do not invent tails or components. Max 5 findings.
OUTPUT JSON: [{"tail_number","component","risk":"high|medium|low","pattern","recommendation"}]`,
              },
            ],
          },
        ],
        config: { responseMimeType: 'application/json', temperature: 0.15 },
      }));
      const parsed = safeParse(DiagnosticsSchema, response.text, 'Diagnostics');
      if (!parsed) {
        setError('AI returned an unparseable response. Try again in a moment.');
        setFindings([]);
        reportError('diagnostics', { kind: 'parse', message: 'Gemini response failed schema validation', retryable: false });
      } else {
        setFindings(parsed);
        reportSuccess('diagnostics');
      }
    } catch (err) {
      console.error('Diagnostics failed', err);
      const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
      setError(classified.message);
      reportError('diagnostics', classified);
    } finally {
      setLoading(false);
    }
  };

  if (!profile || (profile.amuId === 'ALL' || profile.shopId === 'ALL')) {
    return (
      <div className="p-8">
        <p className="text-slate-500 text-sm">
          Select a specific AMU and Shop to run predictive diagnostics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase">Predictive Diagnostics</h2>
            <p className="serif-header text-sm text-slate-500 italic">
              Gemini-assisted component failure analysis &middot; {byTail.length} repeat tails
            </p>
          </div>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="sleek-button bg-primary text-white flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {loading ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </header>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <section className="space-y-4">
        {findings.length === 0 && !loading ? (
          <p className="text-slate-400 text-sm italic">
            Run analysis to surface predictive failure patterns across tails with repeat entries.
          </p>
        ) : (
          findings.map((f, i) => (
            <div key={`${f.tail_number}-${i}`} className="bg-white border border-outline p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="tech-label text-[10px] text-slate-500">{f.tail_number}</p>
                  <h4 className="text-lg font-black uppercase tracking-tight mt-1">
                    {f.component}
                  </h4>
                </div>
                <span
                  className={cn(
                    'badge',
                    f.risk === 'high' && 'bg-red-100 text-red-700',
                    f.risk === 'medium' && 'bg-amber-100 text-amber-700',
                    f.risk === 'low' && 'bg-emerald-100 text-emerald-700'
                  )}
                >
                  {f.risk.toUpperCase()} RISK
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="tech-label text-[9px] text-slate-400 mb-1">Pattern</p>
                  <p className="text-sm text-slate-700">{f.pattern}</p>
                </div>
                <div>
                  <p className="tech-label text-[9px] text-slate-400 mb-1">Recommendation</p>
                  <p className="text-sm text-slate-700">{f.recommendation}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};
