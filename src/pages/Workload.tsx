import React, { useEffect, useMemo, useState } from 'react';
import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { MaintenanceLog, UserProfile } from '../types';
import { tsToMillis } from '../lib/utils';
import { subDays } from 'date-fns';
import { cn } from '../lib/utils';

type TechStat = {
  uid: string;
  name: string;
  manNumber: string;
  logCount: number;
  redBallCount: number;
  recentCount: number;
};

const WINDOW_DAYS = 30;
const RECENT_DAYS = 7;

export const Workload: React.FC = () => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!profile) return;
    if (!(profile.role === 'ncoic' || profile.role === 'leadership')) return;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') return;

    const qLogs = query(
      collection(db, 'logs'),
      where('amuId', '==', profile.amuId),
      where('shopId', '==', profile.shopId),
      where('isDemo', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );
    const unsubL = onSnapshot(
      qLogs,
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MaintenanceLog)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'logs')
    );

    const qUsers = query(
      collection(db, 'users'),
      where('amuId', '==', profile.amuId),
      where('shopId', '==', profile.shopId),
      where('isDemo', '==', false)
    );
    const unsubU = onSnapshot(
      qUsers,
      (snap) => setPeople(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      unsubL();
      unsubU();
    };
  }, [profile]);

  const { stats, mean, max } = useMemo(() => {
    const windowCutoff = subDays(new Date(), WINDOW_DAYS).getTime();
    const recentCutoff = subDays(new Date(), RECENT_DAYS).getTime();
    const byMan = new Map<string, TechStat>();

    people.forEach((p) => {
      byMan.set(p.man_number, {
        uid: p.uid,
        name: p.name,
        manNumber: p.man_number,
        logCount: 0,
        redBallCount: 0,
        recentCount: 0,
      });
    });

    logs.forEach((l) => {
      const ms = tsToMillis(l.timestamp);
      if (ms === 0 || ms < windowCutoff) return;
      const entry = byMan.get(l.man_number);
      if (!entry) return;
      entry.logCount += 1;
      if (l.isRedBall) entry.redBallCount += 1;
      if (ms >= recentCutoff) entry.recentCount += 1;
    });

    const arr = Array.from(byMan.values()).sort((a, b) => b.logCount - a.logCount);
    const total = arr.reduce((s, t) => s + t.logCount, 0);
    const m = arr.length > 0 ? total / arr.length : 0;
    const mx = arr.reduce((s, t) => Math.max(s, t.logCount), 0);
    return { stats: arr, mean: m, max: mx };
  }, [logs, people]);

  const classify = (count: number): 'high' | 'normal' | 'low' => {
    if (mean === 0) return 'normal';
    if (count >= mean * 1.5) return 'high';
    if (count <= mean * 0.5) return 'low';
    return 'normal';
  };

  if (!profile || !(profile.role === 'ncoic' || profile.role === 'leadership')) {
    return (
      <div className="p-8">
        <p className="text-slate-500 text-sm">Workload dashboard is restricted to leadership roles.</p>
      </div>
    );
  }

  if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
    return (
      <div className="p-8">
        <p className="text-slate-500 text-sm">
          Select a specific AMU and Shop to view technician workload.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-tour="page-root">
      <header className="flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase">Workload Balance</h2>
          <p className="serif-header text-sm text-slate-500 italic">
            Technician log distribution &middot; last {WINDOW_DAYS} days &middot; mean {mean.toFixed(1)}
          </p>
        </div>
      </header>

      <section className="bg-white border border-outline">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              <th className="px-6 py-4">Technician</th>
              <th className="px-6 py-4">Man #</th>
              <th className="px-6 py-4 text-right">Logs ({WINDOW_DAYS}d)</th>
              <th className="px-6 py-4 text-right">Red Ball</th>
              <th className="px-6 py-4 text-right">Last {RECENT_DAYS}d</th>
              <th className="px-6 py-4">Load</th>
              <th className="px-6 py-4">Distribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {stats.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                  No personnel or log activity in this AMU/Shop.
                </td>
              </tr>
            ) : (
              stats.map((t) => {
                const cls = classify(t.logCount);
                const pct = max > 0 ? (t.logCount / max) * 100 : 0;
                return (
                  <tr key={t.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-black text-sm uppercase">{t.name}</td>
                    <td className="px-6 py-4 data-mono text-sm">{t.manNumber}</td>
                    <td className="px-6 py-4 text-right font-black text-lg">{t.logCount}</td>
                    <td className="px-6 py-4 text-right font-bold text-safety-orange">
                      {t.redBallCount || '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">{t.recentCount}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'badge inline-flex items-center gap-1',
                          cls === 'high' && 'bg-red-100 text-red-700',
                          cls === 'normal' && 'bg-emerald-100 text-emerald-700',
                          cls === 'low' && 'bg-amber-100 text-amber-700'
                        )}
                      >
                        {cls === 'high' && <TrendingUp className="w-3 h-3" />}
                        {cls === 'normal' && <Minus className="w-3 h-3" />}
                        {cls === 'low' && <TrendingDown className="w-3 h-3" />}
                        {cls.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 w-48">
                      <div className="h-2 bg-slate-100 w-full">
                        <div
                          className={cn(
                            'h-full transition-all',
                            cls === 'high' && 'bg-red-500',
                            cls === 'normal' && 'bg-primary',
                            cls === 'low' && 'bg-amber-500'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};
