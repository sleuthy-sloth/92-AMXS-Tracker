import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
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
import { AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { OnboardingApprovalForm } from '../components/OnboardingApprovalForm';

export const Onboarding: React.FC = () => {
  const { profile } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return unsubscribe;
  }, [profile]);

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
          <OnboardingApprovalForm
            key={selectedUser.uid}
            user={selectedUser}
            profile={profile}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
