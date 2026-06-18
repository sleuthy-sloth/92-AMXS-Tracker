import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, ShieldAlert, Info, Plane, GraduationCap, Repeat } from 'lucide-react';
import { MaintenanceLog, TrainingRecord, UserProfile } from '../../types';
import { tsToDate } from '../../lib/utils';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

export interface IntelDrillDown {
  /** The alert id that triggered this drill-down */
  alertId: string;
  /** Alert title for the modal header */
  title: string;
  /** Alert type for styling */
  type: 'critical' | 'warning' | 'info';
  /** What category of drill-down data to show */
  category: 'redball' | 'recurring' | 'training-expired' | 'training-expiring' | 'generic';
  /** Optional tail number filter (for recurring/redball) */
  tailNumber?: string;
}

interface Props {
  drillDown: IntelDrillDown | null;
  onClose: () => void;
  logs: MaintenanceLog[];
  training: TrainingRecord[];
  personnel: UserProfile[];
}

export const IntelligenceDetailModal: React.FC<Props> = ({
  drillDown,
  onClose,
  logs,
  training,
  personnel,
}) => {
  const detailData = useMemo(() => {
    if (!drillDown) return null;

    switch (drillDown.category) {
      case 'redball': {
        const items = logs.filter((l) => l.isRedBall);
        return { items, count: items.length, type: 'logs' as const };
      }
      case 'recurring': {
        const tailCounts = new Map<string, number>();
        logs.forEach((l) => {
          tailCounts.set(l.tail_number, (tailCounts.get(l.tail_number) || 0) + 1);
        });
        const recurring = Array.from(tailCounts.entries())
          .filter(([, count]) => count > 1)
          .sort((a, b) => b[1] - a[1]);
        const topTail = drillDown.tailNumber || recurring[0]?.[0];
        const items = logs.filter((l) => l.tail_number === topTail);
        return {
          items,
          count: items.length,
          type: 'logs' as const,
          tailNumber: topTail,
          recurring,
        };
      }
      case 'training-expired': {
        const items = training.filter((t) => t.status === 'expired');
        return { items, count: items.length, type: 'training' as const };
      }
      case 'training-expiring': {
        const items = training.filter((t) => t.status === 'expiring');
        return { items, count: items.length, type: 'training' as const };
      }
      default:
        return null;
    }
  }, [drillDown, logs, training]);

  const typeStyles = {
    critical: {
      icon: ShieldAlert,
      color: 'text-red-600',
      bg: 'bg-red-100',
      border: 'border-red-500',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      border: 'border-amber-500',
    },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-500' },
  };

  const style = drillDown ? typeStyles[drillDown.type] : typeStyles.info;
  const Icon = style.icon;

  return (
    <AnimatePresence>
      {drillDown && detailData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Intelligence detail: ${drillDown.title}`}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col border-t-4"
            style={{
              borderTopColor:
                drillDown.type === 'critical'
                  ? '#ef4444'
                  : drillDown.type === 'warning'
                    ? '#f59e0b'
                    : '#3b82f6',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-outline bg-slate-50 flex justify-between items-start">
              <div className="flex items-start gap-4">
                <div
                  className={cn('w-10 h-10 flex items-center justify-center shrink-0', style.bg)}
                >
                  <Icon className={cn('w-5 h-5', style.color)} />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight uppercase text-slate-900">
                    {drillDown.title}
                  </h2>
                  <p className="tech-label text-[10px] text-slate-400 mt-1">
                    {detailData.count}{' '}
                    {detailData.type === 'logs' ? 'maintenance record' : 'training record'}
                    {detailData.count !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-900 transition-colors p-2"
                aria-label="Close detail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {detailData.type === 'logs' &&
                detailData.items.map((log) => {
                  const dt = tsToDate(log.timestamp);
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'p-4 border-l-4 bg-slate-50 flex gap-4',
                        log.isRedBall ? 'border-l-red-500' : 'border-l-slate-300'
                      )}
                    >
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Plane className="w-4 h-4 text-slate-400" />
                        <span className="tech-label text-[9px] font-black text-slate-900">
                          {log.tail_number}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {log.discrepancy}
                          </span>
                          {log.isRedBall && (
                            <span className="text-[8px] font-black text-red-600 bg-red-100 px-2 py-0.5 uppercase tracking-wider shrink-0">
                              Red Ball
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          <span className="font-bold">Repair:</span>{' '}
                          {log.repair || 'No repair logged'}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="tech-label">{log.technician_name}</span>
                          <span>·</span>
                          <span className="tech-label">{log.shift || 'Unspecified shift'}</span>
                          {log.jcn && (
                            <>
                              <span>·</span>
                              <span className="tech-label">JCN: {log.jcn}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{dt && format(dt, 'MMM d, yyyy HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {detailData.type === 'training' &&
                detailData.items.map((t) => {
                  // Find matching personnel for man_number
                  const person = personnel.find((p) => p.man_number === t.man_number);
                  return (
                    <div
                      key={t.id || `${t.man_number}-${t.course_name}`}
                      className={cn(
                        'p-4 border-l-4 bg-slate-50 flex gap-4',
                        t.status === 'expired' ? 'border-l-red-500' : 'border-l-amber-500'
                      )}
                    >
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <GraduationCap className="w-4 h-4 text-slate-400" />
                        <span className="tech-label text-[9px] font-black text-slate-900">
                          {t.man_number}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {person?.name || t.personnel_name || 'Unknown'}
                          </span>
                          <span
                            className={cn(
                              'text-[8px] font-black px-2 py-0.5 uppercase tracking-wider shrink-0',
                              t.status === 'expired'
                                ? 'text-red-600 bg-red-100'
                                : 'text-amber-600 bg-amber-100'
                            )}
                          >
                            {t.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          <span className="font-bold">Course:</span> {t.course_name}
                          {t.course_code && (
                            <span className="tech-label ml-2">({t.course_code})</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="tech-label">Due: {t.due_date}</span>
                          {person && (
                            <>
                              <span>·</span>
                              <span className="tech-label">{person.rank}</span>
                              <span>·</span>
                              <span className="tech-label">{person.shopId}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Recurring tails summary (shown alongside the specific tail's logs) */}
              {drillDown.category === 'recurring' && detailData.recurring && (
                <div className="mt-4 p-4 bg-sidebar text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Repeat className="w-4 h-4 text-primary" />
                    <span className="tech-label text-[10px] uppercase tracking-widest">
                      All Recurring Tail Numbers
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {detailData.recurring.map(([tail, count]) => (
                      <div
                        key={tail}
                        className={cn(
                          'flex justify-between items-center p-2 border',
                          tail === detailData.tailNumber
                            ? 'border-primary bg-primary/20'
                            : 'border-white/10 bg-white/5'
                        )}
                      >
                        <span className="tech-label text-[10px] font-black">{tail}</span>
                        <span className="text-[10px] text-white/60">{count} entries</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailData.count === 0 && (
                <div className="py-10 text-center">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">
                    No detailed records available for this alert.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

IntelligenceDetailModal.displayName = 'IntelligenceDetailModal';
