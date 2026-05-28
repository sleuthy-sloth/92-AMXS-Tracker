import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreVertical,
  ChevronDown,
  History as HistoryIcon,
  UploadCloud,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { MaintenanceLog, DIFMLog } from '../../types';
import { cn } from '../../lib/utils';
import { exportLogsToCSV, exportLogsToPDF, exportTurnoverToPDF } from '../../lib/exportUtils';

interface LogActionsMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  logs: MaintenanceLog[];
  difm: DIFMLog[];
  shopId: string;
  amuId: string;
  onBulkScan: () => void;
}

export const LogActionsMenu: React.FC<LogActionsMenuProps> = ({
  isOpen,
  onToggle,
  logs,
  difm,
  shopId,
  amuId,
  onBulkScan,
}) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          'h-[48px] px-4 flex items-center gap-2 border-2 transition-all bg-white font-black text-[10px] tracking-[0.2em] uppercase',
          isOpen
            ? 'border-primary text-primary'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        )}
        aria-label={isOpen ? 'Close management menu' : 'Open management menu'}
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" />
        <span className="hidden sm:inline">Management</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={onToggle} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-64 bg-white border border-outline shadow-2xl z-20 flex flex-col divide-y divide-outline"
            >
              <div className="p-4 bg-putty/20">
                <span className="tech-label !text-[8px] text-primary">Shift Operations</span>
              </div>

              <button
                onClick={() => {
                  exportTurnoverToPDF(logs, difm, shopId, amuId, 'Current');
                  onToggle();
                }}
                className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 rounded-none bg-sidebar flex items-center justify-center">
                  <HistoryIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-black text-[10px] tracking-widest uppercase">
                    Turnover Report
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                    Generate shift handover PDF
                  </p>
                </div>
              </button>

              <div className="p-4 bg-putty/20">
                <span className="tech-label !text-[8px] text-primary">Data Import & Export</span>
              </div>

              <button
                data-tour="logs-bulk-scan"
                onClick={() => {
                  onBulkScan();
                  onToggle();
                }}
                className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 rounded-none bg-putty flex items-center justify-center">
                  <UploadCloud className="w-4 h-4 text-slate-700" />
                </div>
                <div>
                  <p className="font-black text-[10px] tracking-widest uppercase truncate">
                    Bulk Logbook Scan
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                    Batch OCR from photos
                  </p>
                </div>
              </button>

              <div className="grid grid-cols-2">
                <button
                  onClick={() => exportLogsToCSV(logs, shopId)}
                  className="p-4 hover:bg-slate-50 flex flex-col items-center gap-2 border-r border-outline"
                >
                  <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                  <span className="font-black text-[9px] tracking-widest uppercase">CSV</span>
                </button>
                <button
                  onClick={() => exportLogsToPDF(logs, shopId)}
                  className="p-4 hover:bg-slate-50 flex flex-col items-center gap-2"
                >
                  <FileText className="w-5 h-5 text-slate-400" />
                  <span className="font-black text-[9px] tracking-widest uppercase">PDF</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
