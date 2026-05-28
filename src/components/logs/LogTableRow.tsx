import React from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { Camera, CheckCircle2, Wrench, Trash2 } from 'lucide-react';
import { History as HistoryIcon } from 'lucide-react';
import { MaintenanceLog } from '../../types';
import { cn, tsToDate } from '../../lib/utils';

interface LogTableRowProps {
  log: MaintenanceLog;
  index: number;
  currentUserId?: string;
  onClick: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const LogTableRow: React.FC<LogTableRowProps> = ({
  log,
  index,
  currentUserId,
  onClick,
  onEdit,
  onArchive,
  onDelete,
}) => {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="hover-invert cursor-pointer"
      onClick={onClick}
    >
      <td className="px-8 py-5">
        <div className="data-mono text-sm font-black">{log.tail_number}</div>
        <div className="tech-label text-[10px] mt-1 opacity-70 font-bold">
          {log.jcn || `ID: #${log.id?.slice(0, 6)}`}
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="data-mono text-xs">
          {log.timestamp ? format(tsToDate(log.timestamp), 'yyyy.MM.dd') : 'Pending'}
        </div>
        {log.shift && (
          <span className="tech-label text-[10px] mt-1 block opacity-70 font-bold">
            {log.shift} Shift
          </span>
        )}
      </td>
      <td className="px-8 py-5">
        <p className="font-black text-[12px] uppercase tracking-tight text-slate-900">
          {log.technician_name}
        </p>
        {log.personnel && log.personnel.length > 0 && (
          <p className="tech-label text-[10px] mt-1 text-slate-500 font-bold">
            +{log.personnel.length} Support
          </p>
        )}
      </td>
      <td className="px-8 py-5 max-w-xs relative">
        <p
          className={cn(
            'serif-header text-xs line-clamp-2 text-slate-600',
            log.editingBy && log.editingBy !== currentUserId && 'opacity-50'
          )}
        >
          {log.discrepancy}
        </p>
        {log.editingBy && log.editingBy !== currentUserId && (
          <div className="absolute top-1/2 left-8 -translate-y-1/2 flex items-center gap-2 bg-slate-800 text-white px-2 py-1 shadow-lg pointer-events-none">
            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-black uppercase tracking-widest leading-none">
              {log.editingByName || 'Someone'} is editing
            </span>
          </div>
        )}
      </td>
      <td className="px-8 py-5">
        {log.g081_photo ? (
          <div className="flex gap-2 items-center">
            {log.g081_status === 'verified' ? (
              <div
                className="w-7 h-7 rounded-none bg-emerald-100 flex items-center justify-center"
                title="Verified in G081"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            ) : (
              <div
                className="w-7 h-7 rounded-none bg-caution-yellow/10 flex items-center justify-center"
                title="G081 Proof Uploaded - Pending Review"
              >
                <Camera className="w-3.5 h-3.5 text-caution-yellow" />
              </div>
            )}
          </div>
        ) : (
          <span className="tech-label !text-[8px] opacity-20">No Proof</span>
        )}
      </td>
      <td className="px-8 py-5">
        {log.isRedBall ? (
          <span className="badge badge-danger">RED BALL</span>
        ) : (
          <span className="badge bg-slate-100 text-slate-500">NORMAL</span>
        )}
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors"
            title="Edit"
          >
            <Wrench className="w-4 h-4" />
          </button>
          <button
            onClick={onArchive}
            className={cn(
              'p-2 hover:bg-slate-100 transition-colors',
              log.isArchived ? 'text-emerald-600' : 'text-amber-600'
            )}
            title={log.isArchived ? 'Restore' : 'Archive'}
          >
            <HistoryIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-safety-orange transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};
