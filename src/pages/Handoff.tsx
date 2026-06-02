import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, Send, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import {
  collection,
  addDoc,
  query,
  deleteDoc,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContextInstance';
import { ShiftType } from '../types';
import { format } from 'date-fns';
import { tsToDate } from '../lib/utils';
import type { FirestoreTime } from '../types';

interface HandoffItem {
  id: string;
  text: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

interface HandoffDoc {
  id: string;
  shopId: string;
  amuId: string;
  fromShift: ShiftType;
  toShift: ShiftType;
  createdBy: string;
  createdByName?: string;
  createdAt: FirestoreTime;
  items: HandoffItem[];
  closedAt?: FirestoreTime;
}

const SHIFT_OPTIONS: ShiftType[] = ['Days', 'Swings', 'Nights', 'Weekend Duty'];

export const Handoff: React.FC = () => {
  const { profile } = useAuth();
  const [handoffs, setHandoffs] = useState<HandoffDoc[]>([]);
  const [newFromShift, setNewFromShift] = useState<ShiftType>('Days');
  const [newToShift, setNewToShift] = useState<ShiftType>('Swings');
  const [newItems, setNewItems] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile || profile.amuId === 'ALL' || profile.shopId === 'ALL') return;
    const q = query(
      collection(db, 'handoffs'),
      where('amuId', '==', profile.amuId),
      where('shopId', '==', profile.shopId),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setHandoffs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HandoffDoc)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'handoffs')
    );
    return unsub;
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert('Select a specific AMU and Shop before posting a handoff.');
      return;
    }
    const lines = newItems
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      alert('Add at least one handoff item.');
      return;
    }
    setSubmitting(true);
    try {
      const items: HandoffItem[] = lines.map((text, idx) => ({
        id: `${Date.now()}-${idx}`,
        text,
        acknowledged: false,
      }));
      await addDoc(collection(db, 'handoffs'), {
        shopId: profile.shopId,
        amuId: profile.amuId,
        fromShift: newFromShift,
        toShift: newToShift,
        createdBy: profile.uid,
        createdByName: profile.name,
        createdAt: serverTimestamp(),
        items,
      });
      setNewItems('');
    } catch (err) {
      console.error('Failed to create handoff:', err);
      alert(`Could not post handoff: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const acknowledge = async (handoff: HandoffDoc, itemId: string) => {
    if (!profile) return;
    try {
      const updated = handoff.items.map((i) =>
        i.id === itemId ? { ...i, acknowledged: true, acknowledgedBy: profile.name } : i
      );
      await updateDoc(doc(db, 'handoffs', handoff.id), { items: updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `handoffs/${handoff.id}`);
    }
  };

  const deleteHandoff = async (handoffId: string) => {
    if (!profile) return;
    if (!window.confirm('Delete this entire handoff block? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'handoffs', handoffId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `handoffs/${handoffId}`);
    }
  };

  const deleteHandoffItem = async (handoff: HandoffDoc, itemId: string) => {
    if (!profile) return;
    if (!window.confirm('Delete this handoff item?')) return;
    try {
      const updated = handoff.items.filter((i) => i.id !== itemId);
      if (updated.length === 0) {
        await deleteDoc(doc(db, 'handoffs', handoff.id));
      } else {
        await updateDoc(doc(db, 'handoffs', handoff.id), { items: updated });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `handoffs/${handoff.id}`);
    }
  };

  const openCount = useMemo(
    () => handoffs.reduce((n, h) => n + h.items.filter((i) => !i.acknowledged).length, 0),
    [handoffs]
  );

  return (
    <div className="space-y-8" data-tour="page-root">
      <header className="flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase">Shift Handoff</h2>
          <p className="serif-header text-sm text-slate-500 italic">
            Open items for the incoming shift &middot; {openCount} outstanding
          </p>
        </div>
      </header>

      <section className="bg-white border border-outline p-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">
          Post New Handoff
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="tech-label text-[10px] text-slate-600">From Shift</span>
              <select
                value={newFromShift}
                onChange={(e) => setNewFromShift(e.target.value as ShiftType)}
                className="sleek-input w-full mt-1"
              >
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="tech-label text-[10px] text-slate-600">To Shift</span>
              <select
                value={newToShift}
                onChange={(e) => setNewToShift(e.target.value as ShiftType)}
                className="sleek-input w-full mt-1"
              >
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="tech-label text-[10px] text-slate-600">
              Items (one per line, up to 100)
            </span>
            <textarea
              value={newItems}
              onChange={(e) => setNewItems(e.target.value)}
              rows={6}
              placeholder={'AF-92-001 awaiting BC kit\nLOX cart 3 due inspection'}
              className="sleek-input w-full mt-1 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="sleek-button bg-primary text-white flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Posting…' : 'Post Handoff'}
          </button>
        </form>
      </section>

      <section className="space-y-6">
        {handoffs.length === 0 ? (
          <p className="text-slate-400 text-sm italic">No handoffs yet for this shop/AMU.</p>
        ) : (
          handoffs.map((h) => {
            const open = h.items.filter((i) => !i.acknowledged);
            const canEdit =
              profile?.role === 'leadership' ||
              profile?.role === 'ncoic' ||
              profile?.uid === h.createdBy;
            return (
              <div key={h.id} className="bg-white border border-outline group">
                <header className="p-4 flex justify-between items-center border-b border-outline bg-slate-50 relative">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight">
                      {h.fromShift} → {h.toShift}
                    </h4>
                    <p className="tech-label text-[9px] text-slate-400 mt-1">
                      {h.createdByName || 'Unknown'} &middot;{' '}
                      {h.createdAt ? format(tsToDate(h.createdAt), 'MMM dd HH:mm') : 'pending'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {canEdit && (
                      <button
                        onClick={() => deleteHandoff(h.id)}
                        className="text-slate-300 hover:text-safety-orange transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete entire handoff"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <span
                      className={
                        open.length === 0
                          ? 'badge bg-emerald-100 text-emerald-700'
                          : 'badge bg-amber-100 text-amber-700'
                      }
                    >
                      {open.length === 0 ? 'CLEARED' : `${open.length} OPEN`}
                    </span>
                  </div>
                </header>
                <ul className="divide-y divide-outline">
                  {h.items.map((item) => (
                    <li
                      key={item.id}
                      className="p-4 flex items-start gap-3 group/item hover:bg-slate-50/50 transition-colors"
                    >
                      {item.acknowledged ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={item.acknowledged ? 'line-through text-slate-400' : ''}>
                          {item.text}
                        </p>
                        {item.acknowledged && item.acknowledgedBy && (
                          <p className="tech-label text-[9px] text-emerald-700 mt-1">
                            ACK by {item.acknowledgedBy}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <button
                            onClick={() => deleteHandoffItem(h, item.id)}
                            className="text-slate-300 hover:text-safety-orange transition-colors opacity-0 group-hover/item:opacity-100 p-1"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!item.acknowledged && (
                          <button
                            onClick={() => acknowledge(h, item.id)}
                            className="tech-label text-[10px] text-primary hover:underline p-1"
                          >
                            <Plus className="inline w-3 h-3 mr-1 rotate-45" />
                            ACK
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
