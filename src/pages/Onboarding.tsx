import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  X, 
  UserPlus 
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole, AMUType, ShopType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AMUS, SHOPS } from '../mockData';

export const Onboarding: React.FC = () => {
  const { profile } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rank: '',
    man_number: '',
    shopId: '' as ShopType | '',
    amuId: '' as AMUType | '',
    role: 'technician' as UserRole
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (selectedUser) {
      setFormData({
        name: selectedUser.name,
        rank: selectedUser.rank || '',
        man_number: selectedUser.man_number !== 'PENDING' ? selectedUser.man_number : '',
        shopId: selectedUser.shopId !== 'PENDING' ? (selectedUser.shopId as ShopType) : (profile?.shopId as ShopType) || '',
        amuId: selectedUser.amuId !== 'NONE' ? selectedUser.amuId : (profile?.amuId as AMUType) || '',
        role: 'technician'
      });
    }
  }, [selectedUser, profile]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', selectedUser.uid), {
        ...selectedUser,
        ...formData,
        status: 'active',
        isDemo: false
      });
      setSelectedUser(null);
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (uid: string) => {
    if (!window.confirm('Are you sure you want to reject this access request?')) return;
    try {
      await setDoc(doc(db, 'users', uid), { status: 'rejected' }, { merge: true });
    } catch (error) {
      console.error('Rejection error:', error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">Personnel Onboarding</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Review and approve system access requests</p>
        </div>
        <UserPlus className="text-primary w-12 h-12" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {pendingUsers.length > 0 ? pendingUsers.map(u => (
          <div key={u.uid} className="visible-grid bg-surface p-8 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-slate-50 border border-outline flex items-center justify-center text-primary">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tighter uppercase text-slate-900">{u.rank} {u.name}</h3>
                <p className="tech-label text-slate-500">{u.email}</p>
                <div className="flex gap-4 mt-3">
                  <span className="tech-label bg-slate-50 px-2 py-0.5 text-slate-600">SHOP: {u.shopId}</span>
                  <span className="tech-label bg-slate-50 px-2 py-0.5 text-slate-600">MAN #: {u.man_number}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedUser(u)}
                className="sleek-button px-8 py-3"
              >
                Approve & Assign
              </button>
              <button 
                onClick={() => handleReject(u.uid)}
                className="sleek-button bg-transparent !text-safety-orange border border-outline hover:bg-safety-orange/10 px-8 py-3"
              >
                Reject
              </button>
            </div>
          </div>
        )) : (
          <div className="visible-grid bg-surface py-24 text-center space-y-4 border-dashed">
            <Clock className="w-12 h-12 text-slate-200 mx-auto" />
            <p className="tech-label text-slate-400 uppercase tracking-[0.3em]">No pending access requests found.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface w-full max-w-2xl rounded-none shadow-2xl border border-outline overflow-hidden"
            >
              <div className="p-10 border-b border-outline bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">Onboard Personnel</h3>
                  <p className="tech-label mt-3 text-slate-500">Assign credentials for {selectedUser.name}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 transition-colors text-slate-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleApprove} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label">Full Name</label>
                    <input 
                      required
                      className="sleek-input w-full"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">Man Number</label>
                    <input 
                      required
                      className="sleek-input w-full data-mono"
                      placeholder="00000"
                      value={formData.man_number}
                      onChange={e => setFormData({...formData, man_number: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">AMU Assignment</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.amuId}
                      onChange={e => setFormData({...formData, amuId: e.target.value as AMUType})}
                    >
                      {AMUS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">Shop Assignment</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.shopId}
                      onChange={e => setFormData({...formData, shopId: e.target.value as ShopType})}
                    >
                      {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">System Role</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    >
                      <option value="technician">Technician</option>
                      <option value="ncoic">NCOIC</option>
                      <option value="leadership">Leadership</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label">Rank</label>
                    <input 
                      required
                      className="sleek-input w-full"
                      value={formData.rank}
                      onChange={e => setFormData({...formData, rank: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="sleek-button bg-transparent !text-slate-900 border border-outline hover:bg-slate-100 flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="sleek-button flex-1"
                  >
                    {loading ? 'Processing...' : 'Approve Access'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
