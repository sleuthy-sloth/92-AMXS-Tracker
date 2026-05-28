import React from 'react';
import { MaintenanceLog } from '../../types';
import { cn, tsToDate } from '../../lib/utils';

interface ShiftTimelineProps {
  logs: MaintenanceLog[];
  onLogClick: (log: MaintenanceLog) => void;
}

export const ShiftTimeline: React.FC<ShiftTimelineProps> = ({ logs, onLogClick }) => {
  return (
    <div className="visible-grid bg-surface p-8">
      <p className="tech-label mb-6 uppercase tracking-widest">
        Aero-Maintenance Activity Heatmap (24H)
      </p>
      <div className="relative h-12 bg-background border border-outline flex items-center overflow-hidden">
        <div className="absolute inset-0 flex">
          {/* Nights 1 (0000-0700) */}
          <div
            className="h-full bg-slate-100 flex items-center justify-center border-r border-outline"
            style={{ width: '29.16%' }}
          >
            <span className="tech-label text-[9px] opacity-40 font-bold uppercase">Nights</span>
          </div>
          {/* Days (0700-1500) */}
          <div
            className="h-full bg-primary/10 flex items-center justify-center border-r border-outline"
            style={{ width: '33.33%' }}
          >
            <span className="tech-label text-[9px] opacity-40 font-bold uppercase text-primary">
              Days
            </span>
          </div>
          {/* Swings (1500-2300) */}
          <div
            className="h-full bg-caution-yellow/10 flex items-center justify-center border-r border-outline"
            style={{ width: '33.33%' }}
          >
            <span className="tech-label text-[9px] opacity-40 font-bold uppercase text-caution-yellow">
              Swings
            </span>
          </div>
          {/* Nights 2 (2300-2400) */}
          <div
            className="h-full bg-slate-100 flex items-center justify-center"
            style={{ width: '4.18%' }}
          >
            <span className="tech-label text-[9px] opacity-40 font-bold uppercase">Nights</span>
          </div>
        </div>
        <div className="absolute inset-0 flex px-2 pointer-events-none">
          {logs.slice(0, 50).map((log, i) => {
            const date = tsToDate(log.timestamp);
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const left = ((hours * 60 + minutes) / (24 * 60)) * 100;
            return (
              <div
                key={log.id || i}
                className={cn(
                  'absolute w-1.5 h-6 -translate-x-1/2 transition-all hover:h-8 hover:z-10 cursor-pointer pointer-events-auto',
                  log.isRedBall
                    ? 'bg-safety-orange shadow-[0_0_8px_rgba(255,103,31,0.5)]'
                    : 'bg-primary'
                )}
                style={{ left: `${left}%` }}
                title={`${log.tail_number} [${log.shift}]: ${log.discrepancy}`}
                role="button"
                tabIndex={0}
                aria-label={`${log.tail_number} ${log.shift} shift: ${log.discrepancy}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onLogClick(log);
                  }
                }}
                onClick={() => onLogClick(log)}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between mt-3 px-1 border-t border-outline/30 pt-4">
        <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-slate-200"></div> Nights (23-07)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-primary/20"></div> Days (07-15)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-caution-yellow/20"></div> Swings (15-23)
          </div>
        </div>
        <p className="tech-label text-[8px] opacity-40 font-mono">24H OPERATIONAL CYCLE</p>
      </div>
    </div>
  );
};
