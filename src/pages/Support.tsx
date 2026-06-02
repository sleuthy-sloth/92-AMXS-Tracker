import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Wifi,
  WifiOff,
  Users,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContextInstance';
import { useScanStatus } from '../contexts/AIScanStatusInstance';
import { ScanKind, ScanState } from '../contexts/AIScanStatusTypes';
import { cn } from '../lib/utils';

const SCAN_LABELS: Record<ScanKind, string> = {
  assistant: 'Maintenance Assistant',
  'supply-risk': 'Supply Risk Scan',
  'g081-expiry': 'G081 Expiry Scan',
  training: 'Training Compliance Scan',
  diagnostics: 'Predictive Diagnostics',
  'intelligence-feed': 'Intelligence Feed',
};

const SCAN_ORDER: ScanKind[] = [
  'assistant',
  'intelligence-feed',
  'supply-risk',
  'training',
  'g081-expiry',
  'diagnostics',
];

const formatRelative = (ms?: number): string => {
  if (!ms) return 'Never';
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'Just now';
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// Gemini / OpenRouter errors often come back as multi-line JSON blobs.
// Collapse them to a one-line summary for the status panel — full detail
// is still in the browser console for anyone debugging.
const summariseError = (kind: string, message: string): string => {
  if (kind === 'quota' || kind === 'rate_limit') {
    return 'Primary AI quota reached. Operational fallback active.';
  }
  const firstLine = message.split('\n')[0].trim();
  if (firstLine.length > 160) return firstLine.slice(0, 157) + '…';
  return firstLine;
};

const dotColor = (state: ScanState): string => {
  if (state.status === 'running') return 'bg-sky-500 animate-pulse';
  if (state.status === 'error') {
    if (
      state.lastError?.kind === 'auth' ||
      state.lastError?.kind === 'parse' ||
      state.lastError?.kind === 'unknown'
    ) {
      return 'bg-red-500';
    }
    return 'bg-amber-500';
  }
  if (state.status === 'success') return 'bg-emerald-500';
  return 'bg-slate-300';
};

const AIStatusPanel: React.FC<{ showDetails: boolean }> = ({ showDetails }) => {
  const { statuses } = useScanStatus();
  return (
    <section className="space-y-6" data-tour="ai-health-panel">
      <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3 text-slate-900">
        <Sparkles className="w-6 h-6 text-primary" /> AI System Status
      </h3>
      <div className="p-6 bg-slate-50 border border-outline space-y-3">
        {SCAN_ORDER.map((kind) => {
          const state = statuses[kind];
          return (
            <div key={kind} className="flex items-start gap-3 text-xs">
              <span
                className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0', dotColor(state))}
                title={state.status}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black uppercase tracking-tight text-slate-900 text-[11px]">
                    {SCAN_LABELS[kind]}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {state.lastSource && (
                      <span
                        className={cn(
                          'tech-label text-[8px] px-1.5 py-0.5 border tracking-widest',
                          state.lastSource === 'genai-mil'
                            ? 'border-primary/30 text-primary bg-primary/5'
                            : 'border-amber-500/30 text-amber-700 bg-amber-50'
                        )}
                        title={`Last response served by ${state.lastSource}`}
                      >
                        {state.lastSource}
                      </span>
                    )}
                    <span className="data-mono text-[10px] text-slate-400">
                      {formatRelative(state.lastRunAt)}
                    </span>
                  </div>
                </div>
                {showDetails && state.lastError && (
                  <p className="text-[10px] text-red-600 mt-1 break-words">
                    <span className="font-bold uppercase">{state.lastError.kind}:</span>{' '}
                    {summariseError(state.lastError.kind, state.lastError.message)}
                  </p>
                )}
                {showDetails && state.status === 'running' && (
                  <p className="text-[10px] text-sky-600 mt-1">Running…</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const Support: React.FC = () => {
  const { profile, updateUserPassword } = useAuth();
  const showAIDetails = profile?.role === 'ncoic' || profile?.role === 'leadership';
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [passData, setPassData] = useState({ new: '', confirm: '' });
  const [passStatus, setPassStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) {
      setPassStatus({ type: 'error', msg: 'Passwords do not match' });
      return;
    }
    setIsUpdating(true);
    setPassStatus(null);
    try {
      await updateUserPassword(passData.new);
      setPassStatus({ type: 'success', msg: 'Password updated successfully' });
      setPassData({ new: '', confirm: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPassStatus({ type: 'error', msg: msg || 'Update failed' });
    } finally {
      setIsUpdating(false);
    }
  };

  const faqs = [
    {
      q: 'How do I request access to a different shop?',
      a: 'Contact your NCOIC or a Leadership member. They can edit your profile from the Personnel tab and reassign your shop.',
    },
    {
      q: "My training records aren't showing up correctly.",
      a: "Training records are updated via the 'Upload Training Report' feature in the Training Tracker. Ensure your NCOIC has uploaded the latest report from the training system.",
    },
    {
      q: 'Can I edit a maintenance log after submitting it?',
      a: 'Currently, maintenance logs are permanent once submitted to ensure data integrity. If a mistake was made, please submit a new entry with the correct information and note the correction.',
    },
    {
      q: 'How do I gain administrative access?',
      a: 'Administrative access is restricted to authorized personnel only. If you require admin privileges, contact the System Administrator directly with your justification.',
    },
    {
      q: 'What should I do if the system is slow or unresponsive?',
      a: 'First, refresh your browser. If the issue persists, check your network connection. If it still fails, report the issue to the Technical Support contact listed on this page.',
    },
    {
      q: 'How are maintenance discrepancies tracked?',
      a: 'Discrepancies are tracked in real-time via the Maintenance Logs page. Ensure all entries are accurate and complete to maintain data integrity across shifts.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-16 py-12">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
          <HelpCircle className="w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter uppercase text-slate-900">
          Support & Documentation
        </h1>
        <p className="serif-header text-xl max-w-2xl mx-auto text-slate-600">
          Operational guidance and technical support for the 92nd AMXS Maintenance & Training
          Control System.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 visible-grid bg-surface">
        <div className="p-10 space-y-8 border-r border-outline">
          <section className="space-y-6">
            <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3 text-slate-900">
              <Wifi className="w-6 h-6 text-primary" /> System Connectivity
            </h3>
            <div
              className={cn(
                'p-6 border flex items-center gap-4 transition-all',
                isOnline
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 flex items-center justify-center rounded-none border',
                  isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    : 'bg-red-500/10 border-red-500/20 text-red-500'
                )}
              >
                {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <p className="tech-label text-[10px] text-slate-400 uppercase tracking-widest">
                  Network Status
                </p>
                <p
                  className={cn(
                    'text-lg font-black uppercase tracking-tight',
                    isOnline ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {isOnline ? 'Active Link Established' : 'Offline Cache Mode'}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {isOnline
                    ? 'All maintenance records and training logs are currently syncing with live servers.'
                    : 'System is running in buffered mode. All changes will commit automatically once re-connected.'}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3 text-slate-900">
              <Users className="w-6 h-6 text-primary" /> Technical Oversight
            </h3>
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 border border-outline">
                <p className="tech-label mb-2">System Administrator & Developer</p>
                <p className="font-black text-sm uppercase tracking-tight text-slate-900">
                  TSgt Steven Koehl
                </p>
                <p className="data-mono text-xs mt-1 opacity-60">Steven.Koehl.1@us.af.mil</p>
              </div>
            </div>
          </section>
        </div>
        <div className="p-10">
          <AIStatusPanel showDetails={showAIDetails} />
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-3xl font-black tracking-tighter uppercase text-center">
          Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 gap-0 visible-grid bg-surface">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-outline last:border-b-0">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full p-8 flex justify-between items-center hover:bg-putty/30 transition-colors text-left"
              >
                <span className="font-black text-sm uppercase tracking-tight">{faq.q}</span>
                <ChevronRight
                  className={cn('w-5 h-5 transition-transform', openFaq === i ? 'rotate-90' : '')}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-8 pt-0 serif-header text-base leading-relaxed opacity-70">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Account Management Section */}
      <div className="space-y-8">
        <h2 className="text-3xl font-black tracking-tighter uppercase text-center">
          Account Security
        </h2>
        <div className="visible-grid bg-surface p-10 space-y-8 max-w-2xl mx-auto shadow-lg">
          <div className="space-y-4">
            <h3 className="tech-label text-primary">System Access Credentials</h3>
            <p className="serif-header text-sm text-slate-600">
              You can update your operational password below. Ensure it meets military strength
              requirements.
            </p>
          </div>

          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            <div className="space-y-2">
              <label className="tech-label">New Access Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="sleek-input w-full"
                placeholder="••••••••"
                value={passData.new}
                onChange={(e) => setPassData({ ...passData, new: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="tech-label">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="sleek-input w-full"
                placeholder="••••••••"
                value={passData.confirm}
                onChange={(e) => setPassData({ ...passData, confirm: e.target.value })}
              />
            </div>

            {passStatus && (
              <div
                className={cn(
                  'p-4 border flex items-center gap-3 text-[10px] font-black uppercase tracking-tight',
                  passStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                    : 'bg-safety-orange/10 border-safety-orange/20 text-safety-orange'
                )}
              >
                {passStatus.type === 'success' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                {passStatus.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={isUpdating}
              className="sleek-button w-full py-4 text-xs font-black"
            >
              {isUpdating ? 'Updating Credentials...' : 'Update Credentials'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
