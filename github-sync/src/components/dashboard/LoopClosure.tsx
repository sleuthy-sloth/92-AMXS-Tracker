import React, { useMemo, memo } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { MaintenanceLog } from '../../types';
import { tsToMillis } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';

const STALE_HOURS = 48;

export const LoopClosure: React.FC<{ logs: MaintenanceLog[] }> = memo(({ logs }) => {
  const stale = useMemo(() => {
    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000;
    return logs
      .filter((l) => {
        if (!l.discrepancy) return false;
        if (l.repair && l.repair.trim().length > 0) return false;
        const ms = tsToMillis(l.timestamp);
        return ms > 0 && ms < cutoff;
      })
      .sort((a, b) => tsToMillis(a.timestamp) - tsToMillis(b.timestamp))
      .slice(0, 10);
  }, [logs]);

  return (
    <div className="bg-white border border-outline">
      <div className="p-6 border-b border-outline bg-slate-50 flex justify-between items-center">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            Maintenance Loop Closure
          </h3>
          <p className="tech-label mt-1 text-slate-400">
            Discrepancies open &gt; {STALE_HOURS}h // {stale.length} flagged
          </p>
        </div>
        <AlertCircle className={stale.length > 0 ? 'w-4 h-4 text-safety-orange' : 'w-4 h-4 text-slate-300'} />
      </div>
      <div className="p-4 space-y-2 max-h-[320px] overflow-y-auto">
        {stale.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-2 py-6 text-center">
            All recent discrepancies have a repair entry. Loop closed.
          </p>
        ) : (
          stale.map((l) => {
            const ms = tsToMillis(l.timestamp);
            return (
              <div
                key={l.id}
                className="p-3 bg-slate-50 border-l-4 border-l-safety-orange flex items-start gap-3"
              >
                <Clock className="w-4 h-4 text-safety-orange shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="tech-label text-[10px] font-black text-slate-900">
                      {l.tail_number}
                      {l.isRedBall && (
                        <span className="ml-2 text-[8px] text-safety-orange">RED BALL</span>
                      )}
                    </p>
                    <span className="tech-label text-[8px] text-slate-400 whitespace-nowrap">
                      {ms > 0 ? formatDistanceToNow(new Date(ms), { addSuffix: true }) : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{l.discrepancy}</p>
                  <p className="tech-label text-[8px] text-slate-400 mt-1">
                    {l.technician_name} &middot; No repair logged
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
LoopClosure.displayName = 'LoopClosure';
