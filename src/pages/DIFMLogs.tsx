import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  X,
  Sparkles,
  Package as PackageIcon,
  History as HistoryIcon,
  Loader2,
} from 'lucide-react';
import {
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  limit,
  orderBy,
  QueryConstraint,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DIFMLog } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { MOCK_DIFM } from '../mockData';
import { cn } from '../lib/utils';
import { createNotification } from '../services/notificationService';
import { exportTurnoverToPDF } from '../lib/exportUtils';

export const DIFMLogs: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [firestoreLogs, setFirestoreLogs] = useState<DIFMLog[]>([]);
  const [demoSeededLogs, setDemoSeededLogs] = useState<DIFMLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logsLimit, setLogsLimit] = useState(25);
  const loadingRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    tail_number: '',
    discrepancy: '',
    doc_number: '',
    nsn: '',
    status: 'due-in' as DIFMLog['status'],
    pipeline_status: 'ordered' as DIFMLog['pipeline_status'],
  });
  const [loading, setLoading] = useState(false);

  const hasMore = useMemo(
    () => firestoreLogs.length >= logsLimit,
    [firestoreLogs.length, logsLimit]
  );

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLogsLimit((prev) => prev + 25);
        }
      },
      { threshold: 1.0 }
    );

    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  const logs = useMemo<DIFMLog[]>(() => {
    if (!profile) return [];
    if (!isDemoMode) return firestoreLogs;
    const isLeadership = profile.role === 'leadership';
    const filteredMockDifm = MOCK_DIFM.filter((log) => {
      if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
      if (profile.amuId !== 'ALL' && log.amuId !== profile.amuId) return false;
      if (profile.shopId !== 'ALL' && log.shopId !== profile.shopId) return false;
      return true;
    });
    return [...demoSeededLogs, ...filteredMockDifm];
  }, [isDemoMode, profile, firestoreLogs, demoSeededLogs]);

  useEffect(() => {
    if (!profile || isDemoMode) return;

    let q;
    const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc')];

    if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
      constraints.push(where('amuId', '==', profile.amuId));
    }
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
      constraints.push(where('shopId', '==', profile.shopId));
    }
    constraints.push(limit(logsLimit));
    q = query(collection(db, 'difm'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirestoreLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as DIFMLog));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'difm');
      }
    );
    return unsubscribe;
  }, [profile, isDemoMode, logsLimit]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert(
        'DIFM tracks must be assigned to a specific AMU and Shop. Please select a specific assignment in the sidebar before initiating.'
      );
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'difm'), {
        ...formData,
        shopId: profile.shopId,
        amuId: profile.amuId,
        technician_name: profile.name,
        timestamp: serverTimestamp(),
        isDemo: false,
      });
      setIsModalOpen(false);
      setFormData({
        tail_number: '',
        discrepancy: '',
        doc_number: '',
        nsn: '',
        status: 'due-in',
        pipeline_status: 'ordered',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'difm');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<DIFMLog>) => {
    try {
      const docRef = doc(db, 'difm', id);
      await updateDoc(docRef, updates);

      if (updates.pipeline_status === 'received' && !isDemoMode) {
        const log = logs.find((l) => l.id === id);
        if (log) {
          await createNotification({
            shopId: profile?.shopId || 'ALL',
            type: 'parts',
            title: 'PART RECEIVED',
            message: `${log.tail_number}: ${log.nsn || log.discrepancy.slice(0, 30)} is now RECEIVED.`,
            metadata: { difmId: id, tail_number: log.tail_number },
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `difm/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirm removal of this DIFM track?')) return;
    try {
      await deleteDoc(doc(db, 'difm', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `difm/${id}`);
    }
  };

  const seedMockData = () => {
    const statusOptions: DIFMLog['status'][] = ['due-in', 'awaiting-parts', 'in-repair'];
    const pOptions: DIFMLog['pipeline_status'][] = ['ordered', 'en-route', 'received'];
    const newLogs: DIFMLog[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `new-mock-${Date.now()}-${i}`,
      tail_number: `AF-92-0${500 + i}`,
      discrepancy: `MOCK: Critical component required for JCN ${24000 + i}`,
      doc_number: `F${12000 + i}A`,
      nsn: `5995-01-999-${1000 + i}`,
      status: statusOptions[Math.floor(Math.random() * statusOptions.length)],
      pipeline_status: pOptions[Math.floor(Math.random() * pOptions.length)],
      shopId: profile?.shopId || 'AVIONICS',
      amuId: profile?.amuId || 'BLACK',
      technician_name: profile?.name || 'DEMO ADMIN',
      timestamp: serverTimestamp(),
      isDemo: true,
    }));
    setDemoSeededLogs((prev) => [...newLogs, ...prev]);
  };

  return (
    <div className="space-y-10" data-tour="difm-pipeline">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">
            DIFM Oversight
          </h2>
          <p className="serif-header text-lg mt-1 text-slate-600">
            Due-In From Maintenance status and discrepancy tracking
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {isDemoMode && (
            <button
              onClick={seedMockData}
              className="sleek-button bg-surface border-primary text-primary hover:bg-primary/5 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Seed Mocks
            </button>
          )}
          <button
            onClick={() =>
              exportTurnoverToPDF(
                [],
                logs,
                profile?.shopId || 'ALL',
                profile?.amuId || 'ALL',
                'Current'
              )
            }
            className="sleek-button bg-sidebar !text-white border border-white/10 hover:bg-slate-800 flex items-center gap-2"
          >
            <HistoryIcon className="w-4 h-4 text-white" /> Turnover
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="sleek-button flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Track
          </button>
        </div>
      </div>

      <div className="visible-grid bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                <th className="px-8 py-5">Track Details</th>
                <th className="px-8 py-5 text-center">Logistics Status</th>
                <th className="px-8 py-5">Pipeline Phase</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {logs.map((log, idx) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover:bg-slate-50/50"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 rounded-none border border-outline">
                        <PackageIcon className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-black text-sm tracking-tight uppercase text-slate-900">
                          {log.tail_number}
                        </p>
                        <p className="tech-label text-[10px] mt-1 text-slate-500 font-bold uppercase">
                          {log.doc_number || 'NO DOC #'}
                        </p>
                        <p className="serif-header text-[10px] text-slate-400 mt-2 max-w-xs">
                          {log.discrepancy}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <select
                      value={log.status}
                      onChange={(e) =>
                        handleUpdate(log.id!, { status: e.target.value as DIFMLog['status'] })
                      }
                      className={cn(
                        'badge cursor-pointer appearance-none text-center min-w-[140px] mx-auto',
                        log.status === 'complete'
                          ? 'badge-success'
                          : log.status === 'awaiting-parts'
                            ? 'badge-danger'
                            : log.status === 'in-repair'
                              ? 'badge-warning'
                              : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      <option value="due-in">DUE-IN</option>
                      <option value="awaiting-parts">AWAITING PARTS</option>
                      <option value="in-repair">IN REPAIR</option>
                      <option value="complete">COMPLETE</option>
                    </select>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-2">
                      <select
                        value={log.pipeline_status || 'ordered'}
                        onChange={(e) =>
                          handleUpdate(log.id!, {
                            pipeline_status: e.target.value as DIFMLog['pipeline_status'],
                          })
                        }
                        className="tech-label !text-[9px] bg-white border border-outline px-2 py-1 uppercase font-black"
                      >
                        <option value="ordered">ORDERED</option>
                        <option value="en-route">EN-ROUTE</option>
                        <option value="received">RECEIVED</option>
                        <option value="bench-check">BENCH-CHECK</option>
                        <option value="installed">INSTALLED</option>
                      </select>
                      <div className="h-1 bg-slate-100 w-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{
                            width:
                              log.pipeline_status === 'ordered' || !log.pipeline_status
                                ? '20%'
                                : log.pipeline_status === 'en-route'
                                  ? '40%'
                                  : log.pipeline_status === 'received'
                                    ? '60%'
                                    : log.pipeline_status === 'bench-check'
                                      ? '80%'
                                      : '100%',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button
                      onClick={() => handleDelete(log.id!)}
                      className="p-2 text-slate-300 hover:text-safety-orange transition-colors"
                      title="Remove Track"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <p className="tech-label text-slate-400">
                      No active DIFM tracks found for your shop.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div
            ref={loadingRef}
            className="py-10 flex flex-col items-center justify-center gap-4 border-t border-outline/30 bg-slate-50/50"
          >
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="tech-label text-[10px] opacity-40 uppercase tracking-[0.3em]">
              Loading historical entries...
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-md w-full max-h-[90vh] rounded-none shadow-2xl flex flex-col border border-outline"
            >
              <div className="p-8 border-b border-outline bg-putty/30 flex justify-between items-center shrink-0">
                <h3 className="font-black text-2xl tracking-tighter uppercase">
                  Initiate DIFM Track
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 transition-colors text-slate-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="tech-label">Tail Number</label>
                      <input
                        type="text"
                        required
                        value={formData.tail_number}
                        onChange={(e) =>
                          setFormData({ ...formData, tail_number: e.target.value.toUpperCase() })
                        }
                        className="sleek-input w-full uppercase"
                        placeholder="e.g. 58-0092"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="tech-label">Doc Number</label>
                      <input
                        type="text"
                        value={formData.doc_number}
                        onChange={(e) =>
                          setFormData({ ...formData, doc_number: e.target.value.toUpperCase() })
                        }
                        className="sleek-input w-full uppercase"
                        placeholder="JCN / DOC #"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="tech-label">NSN / Part Number</label>
                    <input
                      type="text"
                      value={formData.nsn}
                      onChange={(e) => setFormData({ ...formData, nsn: e.target.value })}
                      className="sleek-input w-full"
                      placeholder="National Stock Number or P/N"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="tech-label">Maintenance Discrepancy</label>
                    <textarea
                      required
                      rows={3}
                      value={formData.discrepancy}
                      onChange={(e) => setFormData({ ...formData, discrepancy: e.target.value })}
                      className="sleek-input w-full resize-none"
                      placeholder="Describe the failed component..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="tech-label">Initial Track Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as DIFMLog['status'] })
                      }
                      className="sleek-input w-full"
                    >
                      <option value="due-in">Due-In</option>
                      <option value="awaiting-parts">Awaiting Parts</option>
                      <option value="in-repair">In Repair</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 border-2 border-slate-200 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                      {loading ? 'Initializing...' : 'Commit Track'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
