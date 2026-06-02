import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { X, ShieldAlert, Wrench, CheckCircle2 } from 'lucide-react';
import { MaintenanceLog } from '../../types';
import { cn, tsToDate } from '../../lib/utils';
import { SHIFT_TIMES } from '../../mockData';

interface LogDetailsModalProps {
  log: MaintenanceLog | null;
  onClose: () => void;
  onEdit: (log: MaintenanceLog) => void;
  onArchive: (logId: string, archive: boolean) => void;
  onDelete: (logId: string) => void;
}

export const LogDetailsModal: React.FC<LogDetailsModalProps> = ({
  log,
  onClose,
  onEdit,
  onArchive,
  onDelete,
}) => {
  if (!log) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Maintenance log details for ${log.tail_number}`}
        tabIndex={-1}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white max-w-2xl w-full rounded-none shadow-2xl overflow-hidden border border-outline"
        >
          <div className="p-8 border-b border-outline flex justify-between items-center bg-putty/30">
            <div>
              <h3 className="font-black text-3xl tracking-tighter uppercase">{log.tail_number}</h3>
              <p className="tech-label mt-1 opacity-60">
                {log.jcn ? `JCN: ${log.jcn}` : `Log ID: #${log.id?.slice(0, 6)}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 transition-colors text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-2">
                <span className="tech-label">Primary Technician</span>
                <p className="font-black text-sm uppercase tracking-tight">{log.technician_name}</p>
              </div>
              <div className="space-y-2">
                <span className="tech-label">Date Logged</span>
                <p className="data-mono text-sm">
                  {log.timestamp
                    ? format(tsToDate(log.timestamp), 'MMMM dd, yyyy HH:mm')
                    : 'Pending'}
                  {log.shift && (
                    <span className="ml-3 tech-label !text-[8px] bg-putty px-2 py-1">
                      {log.shift} ({SHIFT_TIMES[log.shift]})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {log.personnel && log.personnel.length > 0 && (
              <div className="space-y-3">
                <span className="tech-label">Additional Personnel</span>
                <div className="flex flex-wrap gap-2">
                  {log.personnel.map((p, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-putty text-[10px] font-black uppercase tracking-widest"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="p-6 bg-safety-orange/5 border-l-4 border-safety-orange">
                <span className="tech-label text-safety-orange flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-3 h-3" /> Discrepancy
                </span>
                <p className="serif-header text-base leading-relaxed text-on-surface">
                  {log.discrepancy}
                </p>
              </div>
              <div className="p-6 bg-primary/5 border-l-4 border-primary">
                <span className="tech-label text-primary flex items-center gap-2 mb-3">
                  <Wrench className="w-3 h-3" /> Repair Action
                </span>
                <p className="text-sm leading-relaxed text-on-surface font-medium">{log.repair}</p>
              </div>
            </div>

            {log.doc_number && (
              <div className="space-y-2">
                <span className="tech-label">Document Number</span>
                <p className="data-mono text-base text-primary font-black">{log.doc_number}</p>
              </div>
            )}

            {log.g081_photo && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="tech-label">G081 Screen Proof</span>
                  {log.g081_status === 'verified' && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="tech-label !text-emerald-600">
                        Verified by {log.g081_verified_by}
                      </span>
                    </div>
                  )}
                </div>
                <div className="border border-outline p-2 bg-putty/10">
                  <img
                    src={log.g081_photo}
                    alt="G081 Proof"
                    className="w-full h-auto max-h-96 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-8 border-t border-outline bg-slate-50 flex justify-between items-center">
            <div className="tech-label !text-[8px] opacity-50">
              {log.lastEditedBy && (
                <span>
                  Last edited by {log.lastEditedBy}{' '}
                  {log.lastEditedAt && `on ${format(tsToDate(log.lastEditedAt), 'MM/dd HH:mm')}`}
                </span>
              )}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  onArchive(log.id!, !log.isArchived);
                  onClose();
                }}
                className={cn(
                  'sleek-button border',
                  log.isArchived
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                )}
              >
                {log.isArchived ? 'Restore' : 'Archive'}
              </button>
              <button
                onClick={() => {
                  onDelete(log.id!);
                  onClose();
                }}
                className="sleek-button bg-safety-orange/10 !text-safety-orange border border-safety-orange/30 hover:bg-safety-orange/20"
              >
                Delete Record
              </button>
              <button
                onClick={() => onEdit(log)}
                className="sleek-button bg-white !text-on-surface border border-outline hover:bg-putty"
              >
                Edit Entry
              </button>
              <button onClick={onClose} className="sleek-button px-10">
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
