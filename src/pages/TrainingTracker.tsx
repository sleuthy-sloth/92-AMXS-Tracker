import React, { useState, useMemo } from 'react';
import { Search, Grid, List, FileSpreadsheet, FileText, X, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { TrainingRecord } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { cn } from '../lib/utils';
import { exportTrainingToCSV, exportTrainingToPDF } from '../lib/exportUtils';

// Hooks
import { useTrainingData } from '../hooks/useTrainingData';

// Components
import { TrainingStatsPanel } from '../components/training/TrainingStatsPanel';
import { TrainingUploadZone } from '../components/training/TrainingUploadZone';

export const TrainingTracker: React.FC = () => {
  const { profile } = useAuth();

  // Data hook
  const {
    trainings,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filteredTrainings,
    stats,
  } = useTrainingData();

  // Local UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // Helper to get person name from man_number
  const getPersonName = (manNumber: string) => {
    // In the refactored version, personnel_name is stored directly on the training record
    const training = trainings.find((t) => t.man_number === manNumber);
    return training?.personnel_name || 'Unknown Personnel';
  };

  return (
    <div className="space-y-10" data-tour="page-root">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">
            Training Readiness
          </h2>
          <p className="serif-header text-lg mt-1 text-slate-600">
            Task expiration forecast and qualification oversight
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-surface border border-outline p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'grid'
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowNotifyModal(true)}
                className="sleek-button flex items-center gap-2"
                title="Email Affected Users"
              >
                <Send className="w-4 h-4" /> <span className="hidden sm:inline">Email</span>
              </button>
              <button
                onClick={() => exportTrainingToCSV(filteredTrainings, profile.shopId)}
                className="sleek-button bg-surface !text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />{' '}
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => exportTrainingToPDF(filteredTrainings, profile.shopId)}
                className="sleek-button bg-surface !text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export PDF"
              >
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-0 visible-grid bg-surface">
        <div className="flex-1 relative p-4">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search by course name, man #, or personnel name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-12 w-full !border-none !bg-transparent"
          />
        </div>
        <div className="flex gap-0">
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Due After</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Due Before</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <TrainingStatsPanel stats={stats} />

      {/* Training Records */}
      {viewMode === 'list' ? (
        <div className="visible-grid bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                  <th className="px-8 py-5">Course Name</th>
                  <th className="px-8 py-5">Personnel</th>
                  {profile?.role === 'leadership' && <th className="px-8 py-5">Shop</th>}
                  <th className="px-8 py-5">Due Date</th>
                  <th className="px-8 py-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {filteredTrainings.map((record, idx) => (
                  <motion.tr
                    key={record.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.01 }}
                    className="hover-invert cursor-pointer"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <td className="px-8 py-5">
                      <p className="font-black text-sm tracking-tight uppercase text-slate-900">
                        {record.course_name}
                      </p>
                      {record.course_code && (
                        <p className="tech-label text-[10px] mt-1 text-slate-500">
                          CODE: {record.course_code}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-[12px] uppercase tracking-tight text-slate-900">
                        {record.personnel_name}
                      </p>
                      <p className="tech-label text-[10px] mt-1 text-slate-500">
                        MAN#: {record.man_number}
                      </p>
                    </td>
                    {profile?.role === 'leadership' && (
                      <td className="px-8 py-5">
                        <span className="tech-label">{record.shopId}</span>
                      </td>
                    )}
                    <td className="px-8 py-5">
                      <span className="data-mono text-xs">{record.due_date}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={cn(
                          'badge',
                          record.status === 'current'
                            ? 'badge-success'
                            : record.status === 'expiring'
                              ? 'badge-warning'
                              : 'badge-danger'
                        )}
                      >
                        {record.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredTrainings.map((record, idx) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.02 }}
                className="p-6 bg-surface rounded-lg border border-outline hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedRecord(record)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-black text-lg tracking-tight uppercase text-slate-900">
                      {record.course_name}
                    </h3>
                    {record.course_code && (
                      <p className="tech-label text-[10px] mt-1 text-slate-500">
                        {record.course_code}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'badge',
                      record.status === 'current'
                        ? 'badge-success'
                        : record.status === 'expiring'
                          ? 'badge-warning'
                          : 'badge-danger'
                    )}
                  >
                    {record.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Personnel:</span>
                    <span className="font-bold text-slate-900">{record.personnel_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Due:</span>
                    <span className="data-mono">{record.due_date}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Record Details Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-outline">
                <h2 className="text-2xl font-black">{selectedRecord.course_name}</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="tech-label">Personnel</span>
                  <p className="font-bold text-lg">{selectedRecord.personnel_name}</p>
                </div>
                <div>
                  <span className="tech-label">MAN Number</span>
                  <p className="data-mono">{selectedRecord.man_number}</p>
                </div>
                {selectedRecord.course_code && (
                  <div>
                    <span className="tech-label">Course Code</span>
                    <p>{selectedRecord.course_code}</p>
                  </div>
                )}
                <div>
                  <span className="tech-label">Due Date</span>
                  <p className="data-mono">{selectedRecord.due_date}</p>
                </div>
                <div>
                  <span className="tech-label">Status</span>
                  <span
                    className={cn(
                      'badge ml-2',
                      selectedRecord.status === 'current'
                        ? 'badge-success'
                        : selectedRecord.status === 'expiring'
                          ? 'badge-warning'
                          : 'badge-danger'
                    )}
                  >
                    {selectedRecord.status}
                  </span>
                </div>
                <div>
                  <span className="tech-label">Shop</span>
                  <p>{selectedRecord.shopId}</p>
                </div>
              </div>
              <div className="flex justify-end p-6 border-t border-outline">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="sleek-button bg-primary text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notify Modal */}
      <AnimatePresence>
        {showNotifyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-outline">
                <h2 className="text-2xl font-black">Email Notifications</h2>
                <button
                  onClick={() => setShowNotifyModal(false)}
                  className="p-2 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-4">
                  Send personalized training alerts to personnel with expiring or expired training.
                </p>
                <div className="space-y-4">
                  {filteredTrainings
                    .filter((t) => t.status === 'expiring' || t.status === 'expired')
                    .map((record) => (
                      <div
                        key={record.id}
                        className="p-4 bg-slate-50 rounded border border-outline"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold">{record.personnel_name}</p>
                            <p className="text-sm text-slate-600">{record.course_name}</p>
                            <p className="text-xs text-slate-500">Due: {record.due_date}</p>
                          </div>
                          <span
                            className={cn(
                              'badge',
                              record.status === 'expiring' ? 'badge-warning' : 'badge-danger'
                            )}
                          >
                            {record.status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex justify-end p-6 border-t border-outline">
                <button
                  onClick={() => setShowNotifyModal(false)}
                  className="sleek-button bg-primary text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
