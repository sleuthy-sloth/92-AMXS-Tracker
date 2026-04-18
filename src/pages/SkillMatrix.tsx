import React, { useEffect, useMemo, useState } from 'react';
import { Grid3x3, Plus, X } from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

export const SkillMatrix: React.FC = () => {
  const { profile } = useAuth();
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [newSkill, setNewSkill] = useState<Record<string, string>>({});

  const canEdit = profile?.role === 'ncoic' || profile?.role === 'leadership';

  useEffect(() => {
    if (!profile) return;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') return;
    const q = query(
      collection(db, 'users'),
      where('amuId', '==', profile.amuId),
      where('shopId', '==', profile.shopId),
      where('isDemo', '==', false)
    );
    return onSnapshot(
      q,
      (snap) =>
        setPeople(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
  }, [profile]);

  const { allSkills, coverage } = useMemo(() => {
    const skillSet = new Set<string>();
    people.forEach((p) => (p.skill_tags ?? []).forEach((s) => skillSet.add(s)));
    const list = Array.from(skillSet).sort();
    const cov: Record<string, number> = {};
    list.forEach((s) => {
      cov[s] = people.filter((p) => (p.skill_tags ?? []).includes(s)).length;
    });
    return { allSkills: list, coverage: cov };
  }, [people]);

  const addSkill = async (uid: string) => {
    const s = (newSkill[uid] ?? '').trim();
    if (!s) return;
    try {
      await updateDoc(doc(db, 'users', uid), { skill_tags: arrayUnion(s) });
      setNewSkill((prev) => ({ ...prev, [uid]: '' }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const removeSkill = async (uid: string, s: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { skill_tags: arrayRemove(s) });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  if (!profile || profile.amuId === 'ALL' || profile.shopId === 'ALL') {
    return (
      <div className="p-8">
        <p className="text-slate-500 text-sm">
          Select a specific AMU and Shop to view the skill matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center">
          <Grid3x3 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase">Skill Matrix</h2>
          <p className="serif-header text-sm text-slate-500 italic">
            Qualification coverage &middot; {people.length} personnel &middot; {allSkills.length} tracked skills
          </p>
        </div>
      </header>

      {allSkills.length > 0 && (
        <section className="bg-white border border-outline p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">
            Shop Coverage
          </h3>
          <div className="flex flex-wrap gap-2">
            {allSkills.map((s) => {
              const pct = people.length > 0 ? (coverage[s] / people.length) * 100 : 0;
              return (
                <div
                  key={s}
                  className="flex items-center gap-2 bg-slate-50 border border-outline px-3 py-2"
                >
                  <span className="tech-label text-[10px]">{s}</span>
                  <span
                    className={cn(
                      'badge',
                      pct >= 70 && 'bg-emerald-100 text-emerald-700',
                      pct >= 40 && pct < 70 && 'bg-amber-100 text-amber-700',
                      pct < 40 && 'bg-red-100 text-red-700'
                    )}
                  >
                    {coverage[s]} / {people.length}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-white border border-outline">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              <th className="px-6 py-4">Technician</th>
              <th className="px-6 py-4">Skills</th>
              {canEdit && <th className="px-6 py-4">Add</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {people.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 3 : 2} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                  No personnel in this AMU/Shop.
                </td>
              </tr>
            ) : (
              people.map((p) => (
                <tr key={p.uid} className="hover:bg-slate-50">
                  <td className="px-6 py-4 align-top">
                    <p className="font-black text-sm uppercase">{p.name}</p>
                    <p className="tech-label text-[9px] text-slate-400 mt-1">{p.man_number}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(p.skill_tags ?? []).length === 0 ? (
                        <span className="text-xs text-slate-400 italic">None tagged</span>
                      ) : (
                        (p.skill_tags ?? []).map((s) => (
                          <span
                            key={s}
                            className="badge bg-primary/10 text-primary flex items-center gap-1"
                          >
                            {s}
                            {canEdit && (
                              <button
                                onClick={() => removeSkill(p.uid, s)}
                                className="hover:text-red-600"
                                aria-label={`Remove ${s}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 w-64">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          addSkill(p.uid);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          value={newSkill[p.uid] ?? ''}
                          onChange={(e) =>
                            setNewSkill((prev) => ({ ...prev, [p.uid]: e.target.value }))
                          }
                          placeholder="e.g. BC-kit"
                          className="sleek-input flex-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="sleek-button bg-primary text-white flex items-center gap-1 px-3"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};
