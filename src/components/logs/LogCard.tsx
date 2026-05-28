import React from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { Camera, ShieldCheck, ChevronRight } from 'lucide-react';
import { MaintenanceLog } from '../../types';
import { cn, tsToDate } from '../../lib/utils';
import { SHIFT_TIMES } from '../../mockData';

interface LogCardProps {
  log: MaintenanceLog;
  index: number;
  currentUserId?: string;
  onClick: () => void;
}

export const LogCard: React.FC<LogCardProps> = ({ log, index, currentUserId, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="p-8 flex flex-col justify-between hover:bg-putty/50 transition-colors cursor-pointer group relative overflow-hidden"
      onClick={onClick}
    >
      <div>
        <div className="flex justify-between items-start mb-6">
          <div>
            {log.editingBy && log.editingBy !== currentUserId ? (
              <div className="flex items-center gap-1.5 mb-1 text-sky-500">
                <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">
                  {log.editingByName || 'Someone'} is editing
                </span>
              </div>
            ) : (
              <p className="tech-label mb-1 text-slate-500">
                {log.jcn ? `JCN: ${log.jcn}` : `ID: #${log.id?.slice(0, 6)}`}
              </p>
            )}
            <h3 className="text-2xl font-black tracking-tighter uppercase group-hover:text-primary transition-colors text-slate-900">
              {log.tail_number}
            </h3>
          </div>
          {log.isRedBall && <span className="badge badge-danger">Red Ball</span>}
          {log.g081_photo && (
            <div
              className={cn(
                'badge flex items-center gap-1.5 ml-2',
                log.g081_status === 'verified'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-caution-yellow/10 text-caution-yellow'
              )}
            >
              {log.g081_status === 'verified' ? (
                <ShieldCheck className="w-3 h-3" />
              ) : (
                <Camera className="w-3 h-3" />
              )}
              <span className="uppercase tracking-widest text-[8px]">
                {log.g081_status === 'verified' ? 'G081' : 'Upload'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between border-b border-outline pb-2">
            <span className="tech-label !text-[9px]">Lead Tech</span>
            <span className="font-black text-[10px] uppercase tracking-tight">
              {log.technician_name}
            </span>
          </div>
          <div className="flex justify-between border-b border-outline pb-2">
            <span className="tech-label !text-[9px]">Timestamp</span>
            <span className="data-mono text-[10px]">
              {log.timestamp ? format(tsToDate(log.timestamp), 'yyyy.MM.dd') : 'Pending'}
              {log.shift && (
                <span className="ml-2 opacity-60">
                  [{log.shift} {SHIFT_TIMES[log.shift]}]
                </span>
              )}
            </span>
          </div>
          <div
            className={cn(
              'flex flex-col gap-2',
              log.editingBy && log.editingBy !== currentUserId && 'opacity-50'
            )}
          >
            <span className="tech-label !text-[9px] text-primary">Discrepancy</span>
            <p className="serif-header text-sm leading-relaxed line-clamp-3">{log.discrepancy}</p>
          </div>
        </div>
      </div>

      <div className="tech-label !text-[9px] text-primary group-hover:translate-x-1 transition-transform flex items-center gap-2">
        View Details <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  );
};
