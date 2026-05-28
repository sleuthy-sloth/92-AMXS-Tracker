import React, { useState, useMemo } from 'react';
import { Plus, Grid, List, History as HistoryIcon, ShieldAlert } from 'lucide-react';
import { serverTimestamp, collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceLog } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { cn, tsToDate, tsToMillis, tailMatchesSearch } from '../lib/utils';
import { createNotification } from '../services/notificationService';

// Hooks
import { useMaintenanceLogs } from '../hooks/useMaintenanceLogs';
import { useLogForm } from '../hooks/useLogForm';
import { useLogScanning } from '../hooks/useLogScanning';

// Components
import { LogCard } from '../components/logs/LogCard';
import { LogTableRow } from '../components/logs/LogTableRow';
import { LogSearchFilter } from '../components/logs/LogSearchFilter';
import { ShiftTimeline } from '../components/logs/ShiftTimeline';
import { LogActionsMenu } from '../components/logs/LogActionsMenu';
import { LogDetailsModal } from '../components/logs/LogDetailsModal';
import { LogFormModal } from '../components/logs/LogFormModal';

export const MaintenanceLogs: React.FC = () => {
  const { user, profile, isDemoMode } = useAuth();

  // Data hook
  const {
    logs,
    difm,
    personnelRoster,
    snapshotError,
    hasMoreLogs,
    loadingRef,
    isArchiveView,
    setIsArchiveView,
    demoSeededLogs,
    setDemoSeededLogs,
    demoArchiveOverrides,
    setDemoArchiveOverrides,
  } = useMaintenanceLogs();

  // Form hook
  const {
    formData,
    setFormData,
    isModalOpen,
    setIsModalOpen,
    editingLogId,
    setEditingLogId,
    originalLogState,
    setOriginalLogState,
    loading,
    setLoading,
    resetForm,
  } = useLogForm();

  // Scanning hook
  const {
    isScanning,
    isG081Uploading,
    scanInputRef,
    g081InputRef,
    bulkScanInputRef,
    handleScan,
    handleScanLogbook,
    handleG081Upload,
  } = useLogScanning(setFormData, demoSeededLogs, setDemoSeededLogs);

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<MaintenanceLog | null>(null);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return logs.filter((log) => {
      const matchesSearch =
        tailMatchesSearch(log.tail_number, searchQuery) ||
        log.technician_name.toLowerCase().includes(q) ||
        log.discrepancy.toLowerCase().includes(q) ||
        (log.man_number && log.man_number.includes(searchQuery)) ||
        (log.jcn && log.jcn.toLowerCase().includes(q)) ||
        (log.personnel && log.personnel.some((p) => p.toLowerCase().includes(q)));

      if (!matchesSearch) return false;

      if (start || end) {
        const logDate = tsToDate(log.timestamp);
        if (start && logDate < start) return false;
        if (end && logDate > end) return false;
      }
      return true;
    });
  }, [logs, searchQuery, startDate, endDate]);

  // Business logic handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert(
        'Operational entries must be assigned to a specific AMU and Shop. Please select a specific assignment in the sidebar before submitting.'
      );
      return;
    }
    if (user?.uid === 'mock-user-preview') {
      alert('Demo users cannot modify the live database. This entry will not be saved.');
      setIsModalOpen(false);
      return;
    }

    setLoading(true);

    // Conflict Detection Logic
    if (editingLogId && originalLogState) {
      const latestVersion = logs.find((l) => l.id === editingLogId);
      if (latestVersion && latestVersion.lastEditedAt && originalLogState.lastEditedAt) {
        const latestTime = tsToMillis(latestVersion.lastEditedAt);
        const originalTime = tsToMillis(originalLogState.lastEditedAt);

        if (latestTime > originalTime) {
          const proceed = window.confirm(
            `CONFLICT DETECTED: This log was edited by ${latestVersion.lastEditedBy} while you were working. \n\n` +
              `Their changes: "${latestVersion.repair.slice(0, 100)}..."\n\n` +
              `Click OK to overwrite their changes with yours, or Cancel to review the current log.`
          );
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }
    }

    const personnelArray = formData.personnelInput
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p);

    try {
      if (editingLogId) {
        await updateDoc(doc(db, 'logs', editingLogId), {
          tail_number: formData.tail_number,
          jcn: formData.jcn,
          discrepancy: formData.discrepancy,
          repair: formData.repair,
          doc_number: formData.doc_number,
          isRedBall: formData.isRedBall,
          personnel: personnelArray,
          shift: formData.shift,
          g081_photo: formData.g081Photo || null,
          lastEditedAt: serverTimestamp(),
          editingBy: null,
          editingByName: null,
          editingSince: null,
        });
      } else {
        const newLog: MaintenanceLog = {
          tail_number: formData.tail_number,
          jcn: formData.jcn,
          discrepancy: formData.discrepancy,
          repair: formData.repair,
          doc_number: formData.doc_number,
          isRedBall: formData.isRedBall,
          shopId: profile.shopId,
          amuId: profile.amuId,
          technician_name: profile.name,
          man_number: profile.man_number,
          personnel: personnelArray,
          shift: formData.shift,
          timestamp: serverTimestamp(),
          isDemo: isDemoMode,
          isArchived: false,
          g081_photo: formData.g081Photo || null,
          ...(formData.g081Photo ? { g081_status: 'pending' as const } : {}),
        };
        const docRef = await addDoc(collection(db, 'logs'), newLog);
        console.info('[logs] created', {
          id: docRef.id,
          amuId: newLog.amuId,
          shopId: newLog.shopId,
          isDemo: newLog.isDemo,
          man_number: newLog.man_number,
        });

        if (formData.isRedBall && !isDemoMode) {
          await createNotification({
            shopId: profile.shopId,
            type: 'red-ball',
            title: 'RED BALL ALERT',
            message: `${formData.tail_number}: ${formData.discrepancy.slice(0, 50)}...`,
            metadata: { logId: docRef.id, tail_number: formData.tail_number },
          });
        }
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Failed to ${editingLogId ? 'update' : 'create'} log: ${message}`);
      handleFirestoreError(
        error,
        editingLogId ? OperationType.UPDATE : OperationType.CREATE,
        'logs'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = async (log: MaintenanceLog) => {
    setFormData({
      tail_number: log.tail_number,
      jcn: log.jcn || '',
      discrepancy: log.discrepancy,
      repair: log.repair,
      doc_number: log.doc_number || '',
      personnelInput: log.personnel?.join(', ') || '',
      isRedBall: log.isRedBall || false,
      shift: log.shift || 'Days',
      g081Photo: log.g081_photo || '',
    });
    setEditingLogId(log.id!);
    setOriginalLogState(log);
    setSelectedLog(null);
    setIsModalOpen(true);

    // Set presence flag in DB if not demo mock log
    if (!isDemoMode && log.id && profile) {
      try {
        await updateDoc(doc(db, 'logs', log.id), {
          editingBy: profile.uid,
          editingByName: profile.name,
          editingSince: serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to set presence flag:', err);
      }
    }
  };

  const closeModal = async () => {
    setIsModalOpen(false);

    // Clear presence
    if (editingLogId && !isDemoMode && profile) {
      try {
        await updateDoc(doc(db, 'logs', editingLogId), {
          editingBy: null,
          editingByName: null,
          editingSince: null,
        });
      } catch (err) {
        console.error('Failed to clear presence flag:', err);
      }
    }
    resetForm();
  };

  const handleDeleteLog = async (logId: string) => {
    if (isDemoMode) return;
    if (!window.confirm('Are you sure you want to delete this log? This action is irreversible.'))
      return;
    try {
      await deleteDoc(doc(db, 'logs', logId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'logs');
    }
  };

  const handleArchiveLog = async (logId: string, archive: boolean) => {
    if (isDemoMode) {
      setDemoArchiveOverrides((prev) => ({ ...prev, [logId]: archive }));
      return;
    }
    try {
      await updateDoc(doc(db, 'logs', logId), {
        isArchived: archive,
        archivedAt: archive ? serverTimestamp() : null,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'logs');
    }
  };

  return (
    <div className="space-y-10">
      {snapshotError && !isDemoMode && (
        <div className="border-2 border-red-500 bg-red-50 p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-black text-[11px] tracking-widest uppercase text-red-700">
              Log Feed Unavailable
            </p>
            <p className="text-xs text-red-900 mt-1 font-mono break-all">{snapshotError}</p>
            <p className="text-[11px] text-red-800 mt-2">
              Newly-submitted logs may not appear. If this references a missing index, open the
              Firebase Console link in the developer console to create it.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 flex items-center justify-center">
            <img
              src="https://media.defense.gov/2022/Sep/29/2003087437/-1/-1/0/220929-F-AFHRA-020.JPG"
              alt="92nd AMXS"
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply' }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">
              Maintenance Logs
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="tech-label text-primary font-bold">92ND AMXS</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <p className="serif-header text-sm text-slate-500 italic">
                Operational Readiness & Discrepancy Tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* View Toggle */}
          <div className="flex bg-white border border-outline p-1.5 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-all',
                viewMode === 'grid'
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-900'
              )}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-all',
                viewMode === 'list'
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-900'
              )}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-outline/50 mx-1"></div>
            <button
              onClick={() => setIsArchiveView(!isArchiveView)}
              className={cn(
                'p-2 transition-all flex items-center gap-2',
                isArchiveView ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-900'
              )}
              title={isArchiveView ? 'Viewing Archive' : 'View Archive'}
            >
              <HistoryIcon className="w-4 h-4" />
              {isArchiveView && (
                <span className="text-[9px] font-black uppercase tracking-tighter">Archive</span>
              )}
            </button>
          </div>

          <div className="h-10 w-px bg-outline mx-2 hidden md:block"></div>

          {/* Action Group */}
          <div className="flex items-center gap-3 flex-1 md:flex-none">
            <button
              data-tour="logs-ocr-button"
              onClick={() => setIsModalOpen(true)}
              className="sleek-button flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              <span className="font-black tracking-widest text-[11px] uppercase">New Entry</span>
            </button>

            <LogActionsMenu
              isOpen={isActionsOpen}
              onToggle={() => setIsActionsOpen(!isActionsOpen)}
              logs={filteredLogs}
              difm={difm}
              shopId={profile?.shopId || 'ALL'}
              amuId={profile?.amuId || 'ALL'}
              onBulkScan={() => bulkScanInputRef.current?.click()}
            />
            <input
              type="file"
              ref={bulkScanInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleScanLogbook}
            />
          </div>
        </div>
      </div>

      {/* Shift Timeline */}
      <ShiftTimeline logs={filteredLogs} onLogClick={setSelectedLog} />

      {/* Search & Filter */}
      <LogSearchFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
      />

      {/* Log Display */}
      {viewMode === 'list' ? (
        <div className="visible-grid bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                  <th className="px-8 py-5">Tail / JCN</th>
                  <th className="px-8 py-5">Date / Shift</th>
                  <th className="px-8 py-5">Personnel</th>
                  <th className="px-8 py-5">Discrepancy</th>
                  <th className="px-8 py-5">G081</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {filteredLogs.map((log, idx) => (
                  <LogTableRow
                    key={log.id}
                    log={log}
                    index={idx}
                    currentUserId={profile?.uid}
                    onClick={() => setSelectedLog(log)}
                    onEdit={() => handleEditClick(log)}
                    onArchive={() => handleArchiveLog(log.id!, !log.isArchived)}
                    onDelete={() => handleDeleteLog(log.id!)}
                  />
                ))}
              </tbody>
            </table>
            {hasMoreLogs && (
              <div
                ref={loadingRef}
                className="py-10 flex flex-col items-center justify-center gap-4 border-t border-outline/30 bg-slate-50/50"
              >
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="tech-label text-[10px] opacity-40 uppercase tracking-[0.3em]">
                  Loading historical entries...
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 visible-grid bg-white">
          <AnimatePresence>
            {filteredLogs.map((log, idx) => (
              <LogCard
                key={log.id}
                log={log}
                index={idx}
                currentUserId={profile?.uid}
                onClick={() => setSelectedLog(log)}
              />
            ))}
          </AnimatePresence>
          {hasMoreLogs && (
            <div
              ref={loadingRef}
              className="col-span-1 md:col-span-2 lg:col-span-3 py-16 flex flex-col items-center justify-center gap-4 bg-slate-50/50"
            >
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <span className="tech-label text-[10px] block opacity-40 uppercase tracking-[0.4em] mb-1">
                  Retrieving Records
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <LogDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onEdit={handleEditClick}
        onArchive={handleArchiveLog}
        onDelete={handleDeleteLog}
      />

      <LogFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        editingLogId={editingLogId}
        loading={loading}
        isScanning={isScanning}
        isG081Uploading={isG081Uploading}
        scanInputRef={scanInputRef}
        g081InputRef={g081InputRef}
        personnelRoster={personnelRoster}
      />
    </div>
  );
};
