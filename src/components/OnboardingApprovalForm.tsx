import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, AMUType, ShopType } from '../types';
import { AMUS, SHOPS } from '../mockData';

interface Props {
  user: UserProfile;
  profile: UserProfile | null;
  onClose: () => void;
}

export const OnboardingApprovalForm: React.FC<Props> = ({ user, profile, onClose }) => {
  const [formData, setFormData] = useState(() => ({
    name: user.name,
    rank: user.rank || '',
    man_number: user.man_number !== 'PENDING' ? user.man_number : '',
    shopId:
      user.shopId !== 'PENDING' ? (user.shopId as ShopType) : ((profile?.shopId as ShopType) || ('' as ShopType | '')),
    amuId:
      user.amuId !== 'NONE' ? user.amuId : ((profile?.amuId as AMUType) || ('' as AMUType | '')),
    role: 'technician' as UserRole,
  }));
  const [loading, setLoading] = useState(false);

  const ALLOWED_APPROVAL_ROLES: UserRole[] =
    profile?.role === 'leadership' ? ['technician', 'ncoic', 'leadership'] : ['technician', 'ncoic'];

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ALLOWED_APPROVAL_ROLES.includes(formData.role)) {
      alert(`Your role (${profile?.role}) is not allowed to assign "${formData.role}".`);
      return;
    }
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        name: formData.name,
        rank: formData.rank,
        man_number: formData.man_number,
        shopId: formData.shopId,
        amuId: formData.amuId,
        role: formData.role,
        status: 'active',
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Approval failed: ${message}`);
      console.error('Approval error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface w-full max-w-2xl rounded-none shadow-2xl border border-outline overflow-hidden"
      >
        <div className="p-10 border-b border-outline bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">
              Onboard Personnel
            </h3>
            <p className="tech-label mt-3 text-slate-500">Assign credentials for {user.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 transition-colors text-slate-900">
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="tech-label">Man Number</label>
              <input
                required
                className="sleek-input w-full data-mono"
                placeholder="00000"
                value={formData.man_number}
                onChange={(e) => setFormData({ ...formData, man_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="tech-label">AMU Assignment</label>
              <select
                className="sleek-input w-full"
                value={formData.amuId}
                onChange={(e) => setFormData({ ...formData, amuId: e.target.value as AMUType })}
              >
                {AMUS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="tech-label">Shop Assignment</label>
              <select
                className="sleek-input w-full"
                value={formData.shopId}
                onChange={(e) => setFormData({ ...formData, shopId: e.target.value as ShopType })}
              >
                {SHOPS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="tech-label">System Role</label>
              <select
                className="sleek-input w-full"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              >
                {ALLOWED_APPROVAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === 'ncoic' ? 'NCOIC' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="tech-label">Rank</label>
              <input
                required
                className="sleek-input w-full"
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="sleek-button bg-transparent !text-slate-900 border border-outline hover:bg-slate-100 flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="sleek-button flex-1">
              {loading ? 'Processing...' : 'Approve Access'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
