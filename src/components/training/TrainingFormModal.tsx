import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { TrainingRecord } from '../../types';

interface TrainingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (training: Omit<TrainingRecord, 'id'>) => void;
  training?: TrainingRecord | null;
}

export const TrainingFormModal: React.FC<TrainingFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  training,
}) => {
  const [formData, setFormData] = useState({
    course_name: training?.course_name || '',
    course_code: training?.course_code || '',
    personnel_name: training?.personnel_name || '',
    man_number: training?.man_number || '',
    due_date: training?.due_date || '',
    status: training?.status || ('current' as TrainingRecord['status']),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      isDemo: false,
      createdAt: training?.createdAt,
      createdBy: training?.createdBy,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-6 border-b border-outline">
              <h2 className="text-2xl font-black">{training ? 'Edit Training' : 'Add Training'}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.course_name}
                    onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                    className="sleek-input"
                    placeholder="e.g., F-15E Aircraft Systems"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Course Code</label>
                  <input
                    type="text"
                    value={formData.course_code}
                    onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                    className="sleek-input"
                    placeholder="e.g., AETC-123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Personnel Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.personnel_name}
                    onChange={(e) => setFormData({ ...formData, personnel_name: e.target.value })}
                    className="sleek-input"
                    placeholder="e.g., SSgt Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    MAN Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.man_number}
                    onChange={(e) => setFormData({ ...formData, man_number: e.target.value })}
                    className="sleek-input"
                    placeholder="e.g., 1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="sleek-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as TrainingRecord['status'],
                      })
                    }
                    className="sleek-input"
                  >
                    <option value="current">Current</option>
                    <option value="expiring">Expiring Soon</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline">
                <button
                  type="button"
                  onClick={onClose}
                  className="sleek-button bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button type="submit" className="sleek-button bg-primary text-white">
                  {training ? 'Update' : 'Add'} Training
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
