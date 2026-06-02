import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContextInstance';
import { UserProfile, AMUType, ShopType } from '../types';
import { AMUS, SHOPS } from '../mockData';

export const Setup: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    rank: '',
    man_number: '',
    shopId: '' as ShopType | '',
    amuId: '' as AMUType | '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
      const isMasterAdmin = Boolean(
        superAdminEmail && (user.email === superAdminEmail || user.email === 'admin@us.af.mil')
      );

      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: formData.name,
        rank: formData.rank,
        man_number: formData.man_number,
        shopId: formData.shopId || 'PENDING',
        amuId: formData.amuId || 'NONE',
        phone: formData.phone,
        role: isMasterAdmin ? 'leadership' : 'pending',
        status: isMasterAdmin ? 'active' : 'pending',
        createdAt: serverTimestamp(),
        isDemo: false,
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      await refreshProfile();
    } catch (err: unknown) {
      console.error('Setup error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Setup submission failed. Please check your inputs or connectivity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-xl w-full space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">
            Access Request
          </h2>
          <p className="serif-header text-lg text-slate-600">
            Submit operational details for NCOIC verification
          </p>
        </div>

        <form onSubmit={handleSubmit} className="visible-grid bg-surface p-12 space-y-10 shadow-xl">
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="tech-label">Rank</label>
                <input
                  required
                  className="sleek-input w-full"
                  placeholder="E.G. SrA"
                  value={formData.rank}
                  onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="tech-label">Full Name (Surname, Initial)</label>
                <input
                  required
                  className="sleek-input w-full"
                  placeholder="DOE, J"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="tech-label">Assigned AMU</label>
                <select
                  required
                  className="sleek-input w-full"
                  value={formData.amuId}
                  onChange={(e) => setFormData({ ...formData, amuId: e.target.value as AMUType })}
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
                <label className="tech-label">Assigned Shop</label>
                <select
                  required
                  className="sleek-input w-full"
                  value={formData.shopId}
                  onChange={(e) => setFormData({ ...formData, shopId: e.target.value as ShopType })}
                >
                  <option value="">Select Shop...</option>
                  {SHOPS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="tech-label">Man Number</label>
              <input
                required
                className="sleek-input w-full data-mono"
                placeholder="99999"
                value={formData.man_number}
                onChange={(e) => setFormData({ ...formData, man_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="tech-label">Contact Phone</label>
              <input
                className="sleek-input w-full"
                placeholder="555-0123"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-safety-orange/10 border border-safety-orange/20 flex items-center gap-3 text-safety-orange text-[10px] font-black uppercase tracking-tight">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <button type="submit" disabled={loading} className="sleek-button w-full py-5 text-lg">
              {loading ? 'Transmitting Request...' : 'Request System Access'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="tech-label text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-[0.1em] text-center"
            >
              Sign Out & Try Different Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
