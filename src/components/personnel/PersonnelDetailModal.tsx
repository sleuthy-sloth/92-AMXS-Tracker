import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Phone } from 'lucide-react';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';

interface PersonnelDetailModalProps {
  person: UserProfile | null;
  onClose: () => void;
  onEdit?: (person: UserProfile) => void;
  canEdit?: boolean;
}

export const PersonnelDetailModal: React.FC<PersonnelDetailModalProps> = ({
  person,
  onClose,
  onEdit,
  canEdit = false,
}) => {
  if (!person) return null;

  const getStatusBadge = (status: UserProfile['status']) => {
    const styles = {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span
        className={cn(
          'inline-flex items-center px-3 py-1 rounded text-xs font-bold uppercase border',
          styles[status]
        )}
      >
        {status}
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Personnel details for ${person.name}`}
        tabIndex={-1}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-outline">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-2xl font-black text-primary">{person.name.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-2xl font-black">{person.name}</h2>
                <p className="text-sm text-slate-600">{person.rank}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="tech-label">Status</span>
              {getStatusBadge(person.status)}
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <a href={`mailto:${person.email}`} className="text-primary hover:underline">
                    {person.email}
                  </a>
                </div>
                {person.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <a href={`tel:${person.phone}`} className="text-primary hover:underline">
                      {person.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Assignment */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Assignment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="tech-label">Shop</span>
                  <p className="font-bold">{person.shopId}</p>
                </div>
                <div>
                  <span className="tech-label">AMU</span>
                  <p className="font-bold">{person.amuId}</p>
                </div>
                <div>
                  <span className="tech-label">Role</span>
                  <p className="font-bold uppercase">{person.role}</p>
                </div>
                <div>
                  <span className="tech-label">MAN Number</span>
                  <p className="data-mono">{person.man_number}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-outline">
            {canEdit && onEdit && (
              <button onClick={() => onEdit(person)} className="sleek-button bg-primary text-white">
                Edit Personnel
              </button>
            )}
            <button onClick={onClose} className="sleek-button bg-slate-100 hover:bg-slate-200">
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
