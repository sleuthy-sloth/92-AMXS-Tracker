import React, { useState } from 'react';
import { Users, Wrench, LogOut } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, AMUType, ShopType } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { MOCK_TRAINING, MOCK_LOGS, AMUS, SHOPS } from '../mockData';
import { cn, tsToDate } from '../lib/utils';

// Hooks
import { usePersonnelRoster } from '../hooks/usePersonnelRoster';

// Components
import { PersonnelCard } from '../components/personnel/PersonnelCard';
import { PersonnelSearchBar } from '../components/personnel/PersonnelSearchBar';
import { PersonnelDetailModal } from '../components/personnel/PersonnelDetailModal';

export const Personnel: React.FC = () => {
  const { user, profile, isDemoMode } = useAuth();

  // Data hook
  const { filteredPersonnel, stats, searchQuery, setSearchQuery, shopFilter, setShopFilter } =
    usePersonnelRoster();

  // Local UI state
  const [selectedPerson, setSelectedPerson] = useState<UserProfile | null>(null);
  const [isEditingPerson, setIsEditingPerson] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  // Get training and logs for selected person (mock data for now)
  const personTraining =
    selectedPerson && isDemoMode
      ? MOCK_TRAINING.filter((t) => t.man_number === selectedPerson.man_number)
      : [];

  const personLogs =
    selectedPerson && isDemoMode
      ? MOCK_LOGS.filter((l) => l.man_number === selectedPerson.man_number)
      : [];

  // Business logic handlers
  const handleEditClick = () => {
    if (selectedPerson) {
      setEditForm(selectedPerson);
      setIsEditingPerson(true);
    }
  };

  const handleUpdatePerson = async () => {
    if (!selectedPerson) return;

    if (user?.uid === 'mock-user-preview') {
      alert('Demo users cannot modify the live database.');
      setIsEditingPerson(false);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', selectedPerson.uid), {
        ...editForm,
      });
      setSelectedPerson({ ...selectedPerson, ...editForm } as UserProfile);
      setIsEditingPerson(false);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDeletePerson = async () => {
    if (!selectedPerson) return;

    if (user?.uid === 'mock-user-preview') {
      alert('Demo users cannot modify the live database.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove ${selectedPerson.name}?`)) {
      try {
        await updateDoc(doc(db, 'users', selectedPerson.uid), {
          status: 'inactive',
        });
        setSelectedPerson(null);
        setIsEditingPerson(false);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const canEdit = profile?.role === 'leadership' || profile?.role === 'ncoic';

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">
            Personnel Roster
          </h2>
          <p className="serif-header text-lg mt-1 text-slate-600">
            Shop personnel management and qualification oversight
          </p>
        </div>
        <Users className="text-primary w-12 h-12" />
      </div>

      {/* Stats */}
      <PersonnelCard stats={stats} />

      {/* Search & Filter */}
      <PersonnelSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        shopFilter={shopFilter}
        onShopFilterChange={setShopFilter}
      />

      {/* Personnel Table */}
      <div className="visible-grid bg-surface overflow-hidden">
        <div className="p-8 border-b border-outline flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50">
          <h3 className="font-black text-xl tracking-tighter uppercase text-slate-900">
            Active Duty Roster
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-putty/50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                <th className="px-8 py-5">Rank / Name</th>
                <th className="px-8 py-5">Man #</th>
                {profile?.role === 'leadership' && <th className="px-8 py-5">Shop</th>}
                <th className="px-8 py-5">Role</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {filteredPersonnel.map((p, idx) => (
                <motion.tr
                  key={p.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover-invert cursor-pointer"
                  onClick={() => setSelectedPerson(p)}
                >
                  <td className="px-8 py-5">
                    <p className="font-black text-sm uppercase tracking-tight text-slate-900">
                      {p.rank} {p.name}
                    </p>
                    <p className="tech-label !text-[8px] mt-1 opacity-60">{p.email}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="data-mono text-xs text-slate-700">{p.man_number}</span>
                  </td>
                  {profile?.role === 'leadership' && (
                    <td className="px-8 py-5">
                      <span className="tech-label">{p.shopId}</span>
                    </td>
                  )}
                  <td className="px-8 py-5">
                    <span
                      className={cn(
                        'badge',
                        p.role === 'ncoic' ? 'badge-info' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {p.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      <span className="tech-label !text-[9px]">Active</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPerson && !isEditingPerson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-3xl w-full rounded-none shadow-2xl overflow-hidden border border-outline flex flex-col max-h-[90vh]"
            >
              <div className="p-10 border-b border-outline bg-putty/30 flex justify-between items-start">
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                    <Users className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">
                      {selectedPerson.name}
                    </h3>
                    <p className="tech-label mt-3 opacity-60">
                      {selectedPerson.rank} • {selectedPerson.role.toUpperCase()} • MAN#:{' '}
                      {selectedPerson.man_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {canEdit && (
                    <>
                      <button
                        onClick={handleEditClick}
                        className="p-3 hover:bg-putty transition-colors text-primary border border-outline"
                        title="Edit User"
                      >
                        <Wrench className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleDeletePerson}
                        className="p-3 hover:bg-putty transition-colors text-safety-orange border border-outline"
                        title="Delete User"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedPerson(null)}
                    className="p-3 hover:bg-putty transition-colors border border-outline"
                  >
                    <span className="text-xl">×</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                {/* Training History */}
                <section className="space-y-6">
                  <h4 className="tech-label text-primary">Training History</h4>
                  <div className="grid grid-cols-1 gap-0 visible-grid">
                    {personTraining.length > 0 ? (
                      personTraining.map((t) => (
                        <div
                          key={t.id}
                          className="p-6 flex justify-between items-center hover:bg-putty/30 transition-colors"
                        >
                          <div>
                            <p className="font-black text-xs uppercase tracking-tight">
                              {t.course_name}
                            </p>
                            <p className="tech-label !text-[8px] mt-1 opacity-60">
                              Due Date: <span className="data-mono">{t.due_date}</span>
                            </p>
                          </div>
                          <span
                            className={cn(
                              'badge',
                              t.status === 'current'
                                ? 'badge-success'
                                : t.status === 'expiring'
                                  ? 'badge-warning'
                                  : 'badge-danger'
                            )}
                          >
                            {t.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="tech-label !text-[9px] opacity-40 p-10 text-center uppercase tracking-widest">
                        No training records found.
                      </p>
                    )}
                  </div>
                </section>

                {/* Recent Maintenance */}
                <section className="space-y-6">
                  <h4 className="tech-label text-primary">Recent Maintenance Operations</h4>
                  <div className="grid grid-cols-1 gap-0 visible-grid">
                    {personLogs.length > 0 ? (
                      personLogs.map((l) => (
                        <div key={l.id} className="p-6 hover:bg-putty/30 transition-colors">
                          <div className="flex justify-between items-start mb-4">
                            <p className="font-black text-sm uppercase tracking-tighter">
                              {l.tail_number}
                            </p>
                            <p className="data-mono text-[9px] opacity-60">
                              {l.timestamp
                                ? format(tsToDate(l.timestamp), 'yyyy.MM.dd')
                                : 'Pending'}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[11px] leading-relaxed">
                              <span className="tech-label !text-[8px] text-safety-orange mr-2">
                                DISC:
                              </span>{' '}
                              {l.discrepancy}
                            </p>
                            <p className="text-[11px] leading-relaxed opacity-70">
                              <span className="tech-label !text-[8px] text-primary mr-2">
                                REPAIR:
                              </span>{' '}
                              {l.repair}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="tech-label !text-[9px] opacity-40 p-10 text-center uppercase tracking-widest">
                        No maintenance logs found.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="p-10 border-t border-outline bg-putty/30">
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="sleek-button w-full py-4"
                >
                  Close Personnel Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {selectedPerson && isEditingPerson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-3xl w-full rounded-none shadow-2xl overflow-hidden border border-outline flex flex-col max-h-[90vh]"
            >
              <div className="p-10 border-b border-outline bg-putty/30">
                <h3 className="text-3xl font-black tracking-tighter uppercase">
                  Edit Personnel Profile
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="sleek-input w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Email Address</label>
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="sleek-input w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Contact Phone</label>
                    <input
                      type="text"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="sleek-input w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Man Number</label>
                    <input
                      type="text"
                      value={editForm.man_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, man_number: e.target.value })}
                      className="sleek-input w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">AMU Assignment</label>
                    <select
                      value={editForm.amuId || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, amuId: e.target.value as AMUType })
                      }
                      className="sleek-input w-full"
                    >
                      <option value="">Select AMU...</option>
                      {AMUS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Shop Assignment</label>
                    <select
                      value={editForm.shopId || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, shopId: e.target.value as ShopType })
                      }
                      className="sleek-input w-full"
                    >
                      <option value="">Select Shop...</option>
                      {SHOPS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">System Role</label>
                    <select
                      value={editForm.role || 'technician'}
                      onChange={(e) =>
                        setEditForm({ ...editForm, role: e.target.value as UserProfile['role'] })
                      }
                      className="sleek-input w-full"
                    >
                      <option value="technician">Technician</option>
                      <option value="ncoic">NCOIC</option>
                      <option value="leadership">Leadership</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 p-10 border-t border-outline bg-putty/30">
                <button
                  onClick={() => setIsEditingPerson(false)}
                  className="sleek-button bg-white !text-on-surface border border-outline hover:bg-putty"
                >
                  Cancel
                </button>
                <button onClick={handleUpdatePerson} className="sleek-button px-12">
                  Save Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
