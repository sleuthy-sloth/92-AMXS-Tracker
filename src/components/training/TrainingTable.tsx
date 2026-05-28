import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
import { TrainingRecord } from '../../types';
import { cn } from '../../lib/utils';

interface TrainingTableProps {
  trainings: TrainingRecord[];
  onEdit: (training: TrainingRecord) => void;
  onDelete: (trainingId: string) => void;
  canEdit: boolean;
}

export const TrainingTable: React.FC<TrainingTableProps> = ({
  trainings,
  onEdit,
  onDelete,
  canEdit,
}) => {
  const getStatusIcon = (status: TrainingRecord['status']) => {
    switch (status) {
      case 'current':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'expiring':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: TrainingRecord['status']) => {
    const styles = {
      current: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      expiring: 'bg-amber-50 text-amber-700 border-amber-200',
      expired: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase border',
          styles[status]
        )}
      >
        {getStatusIcon(status)}
        {status}
      </span>
    );
  };

  if (trainings.length === 0) {
    return (
      <div className="text-center py-12 bg-surface rounded-lg border border-outline">
        <p className="text-slate-500">No training records found.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-outline overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-outline">
              <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Course
              </th>
              <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Personnel
              </th>
              <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Due Date
              </th>
              <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Status
              </th>
              {canEdit && (
                <th className="text-right px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            <AnimatePresence>
              {trainings.map((training, idx) => (
                <motion.tr
                  key={training.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-slate-900">{training.course_name}</div>
                      {training.course_code && (
                        <div className="text-xs text-slate-500 mt-1">{training.course_code}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-slate-900">{training.personnel_name}</div>
                      <div className="text-xs text-slate-500 mt-1">{training.man_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {format(new Date(training.due_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(training.status)}</td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(training)}
                          className="p-2 hover:bg-primary/10 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-primary" />
                        </button>
                        <button
                          onClick={() => onDelete(training.id!)}
                          className="p-2 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
};
