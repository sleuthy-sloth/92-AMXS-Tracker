import React, { useState, useEffect, useMemo } from 'react';
import { serverTimestamp, collection, query, orderBy, onSnapshot, updateDoc, doc, limit, where, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Search, Loader2, Camera, Eye, CheckCircle2, ShieldCheck, Check, X, Trash2, Archive, History } from 'lucide-react';
import { cn, tsToDate } from '../lib/utils';

export const G081Gallery: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [firestoreLogs, setFirestoreLogs] = useState<MaintenanceLog[]>([]);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchiveView, setIsArchiveView] = useState(false);

  const logs = useMemo<MaintenanceLog[]>(
    () => (isDemoMode ? [] : firestoreLogs),
    [isDemoMode, firestoreLogs]
  );
  const loading = isDemoMode ? false : firestoreLoading;

  useEffect(() => {
    if (!profile || isDemoMode) return;

    const constraints: any[] = [
      orderBy('timestamp', 'desc'),
      limit(100)
    ];

    if (profile.amuId !== 'ALL') constraints.push(where('amuId', '==', profile.amuId));
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') constraints.push(where('shopId', '==', profile.shopId));
    
    // Default to isArchived false/true based on toggle
    constraints.push(where('isArchived', '==', isArchiveView));

    const q = query(collection(db, 'logs'), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFirestoreLogs(allLogs.filter(log => log.g081_photo));
      setFirestoreLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });
    return unsubscribe;
  }, [profile, isDemoMode, isArchiveView]);

  const handleVerify = async (logId: string) => {
    if (isDemoMode) {
      alert('Action not available in demo mode.');
      return;
    }
    try {
      await updateDoc(doc(db, 'logs', logId), {
        g081_status: 'verified',
        g081_verified_by: profile?.name,
        g081_verified_at: serverTimestamp(),
      });
      
      // The user said: "After G081 has been verified let’s move it to a G081 gallery archive"
      // So we automatically archive it when verified
      await updateDoc(doc(db, 'logs', logId), {
        isArchived: true,
        archivedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logs');
    }
  };

  const handleArchive = async (logId: string, archive: boolean) => {
    try {
      await updateDoc(doc(db, 'logs', logId), {
        isArchived: archive,
        archivedAt: archive ? serverTimestamp() : null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logs');
    }
  };

  const handleDelete = async (logId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo record?')) return;
    try {
      await deleteDoc(doc(db, 'logs', logId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'logs');
    }
  };

  const filteredLogs = logs.filter(log => 
    log.tail_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.technician_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.man_number && log.man_number.includes(searchQuery)) ||
    log.discrepancy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10" data-tour="g081-grid">
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
            <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">G081 Gallery</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="tech-label text-primary font-bold">92ND AMXS</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <p className="serif-header text-sm text-slate-500 italic">Work Proof Verification & Reaction Board</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-outline p-1.5 shadow-sm">
            <button 
              onClick={() => setIsArchiveView(!isArchiveView)}
              className={cn("p-2 transition-all flex items-center gap-2", isArchiveView ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-900")}
              title={isArchiveView ? "Viewing Archive" : "View Archive"}
            >
              <History className="w-4 h-4" />
              {isArchiveView && <span className="text-[10px] font-black uppercase tracking-widest">G081 Archive</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="visible-grid bg-surface p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant z-10" />
          <input 
            type="text" 
            placeholder="Search tail, technician, or man#..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-10 w-full !border-none !bg-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white border border-outline border-dashed">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="tech-label">Scanning for Evidence...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white border border-outline border-dashed">
          <Camera className="w-12 h-12 text-slate-200" />
          <p className="tech-label opacity-40">No G081 Proofs Found in Recent Logs</p>
        </div>
      ) : isArchiveView ? (
        <div className="visible-grid bg-surface overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono border-b border-outline">
                <th className="px-8 py-5">Tail Number</th>
                <th className="px-8 py-5">Technician</th>
                <th className="px-8 py-5">Verified By</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 font-black text-slate-900 uppercase tracking-tighter">{log.tail_number}</td>
                  <td className="px-8 py-5 text-sm uppercase font-medium">{log.technician_name}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-tight text-slate-600">{log.g081_verified_by}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs font-mono text-slate-400">
                    {log.timestamp ? format(tsToDate(log.timestamp), 'MM/dd HH:mm') : 'N/A'}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setSelectedPhoto(log.g081_photo || null)}
                        className="p-2 hover:bg-white border border-transparent hover:border-outline text-slate-600 transition-all"
                        title="View Proof"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleArchive(log.id!, false)}
                        className="p-2 hover:bg-white border border-transparent hover:border-outline text-amber-600 transition-all"
                        title="Restore to Gallery"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(log.id!)}
                        className="p-2 hover:bg-white border border-transparent hover:border-outline text-safety-orange transition-all"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredLogs.map((log) => (
              <motion.div 
                key={log.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white border border-outline overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col"
              >
                <div className="relative aspect-video bg-slate-100 overflow-hidden cursor-zoom-in" onClick={() => setSelectedPhoto(log.g081_photo || null)}>
                  <img 
                    src={log.g081_photo} 
                    alt={`G081 Proof for ${log.tail_number}`} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-10 h-10 text-white" />
                  </div>
                  {log.g081_status === 'verified' && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 flex items-center gap-2 shadow-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-black text-[10px] tracking-widest uppercase">Verified</span>
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-xl tracking-tighter uppercase text-slate-900">{log.tail_number}</h3>
                        <p className="tech-label text-slate-400 !text-[8px] mt-1">{log.technician_name} • {format(tsToDate(log.timestamp), 'MMM dd, HH:mm')}</p>
                      </div>
                      <span className="px-2 py-1 bg-putty text-[9px] font-black uppercase tracking-widest">{log.shopId}</span>
                    </div>

                    <div className="p-3 bg-slate-50 border-l-2 border-slate-200">
                      <p className="text-xs text-slate-600 line-clamp-2 italic">"{log.discrepancy}"</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-outline flex items-center justify-between gap-3">
                    {log.g081_status === 'verified' ? (
                      <div className="flex-1 flex items-center gap-3 text-emerald-600">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="tech-label !text-emerald-600 uppercase">Verified G081 Good</span>
                          <span className="text-[9px] text-emerald-600/60 font-medium">By {log.g081_verified_by}</span>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleVerify(log.id!)}
                        className="flex-1 sleek-button bg-sidebar !text-white flex items-center justify-center gap-3 py-3 group hover:scale-[1.01]"
                      >
                        <Check className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="font-black text-[11px] tracking-widest uppercase text-white">React: G081 Good</span>
                      </button>
                    )}
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleArchive(log.id!, !log.isArchived)}
                        className="p-3 bg-slate-50 border border-outline text-slate-400 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm"
                        title={log.isArchived ? "Restore to Gallery" : "Archive Entry"}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(log.id!)}
                        className="p-3 bg-slate-50 border border-outline text-slate-400 hover:text-safety-orange hover:border-safety-orange/20 transition-all shadow-sm"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stealth/95 backdrop-blur-xl">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="relative max-w-5xl w-full h-full flex flex-col"
             >
                <button 
                  onClick={() => setSelectedPhoto(null)} 
                  className="absolute top-0 right-0 p-4 text-white hover:text-primary z-[120]"
                >
                  <X className="w-10 h-10" />
                </button>
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  <img src={selectedPhoto} alt="Fullscreen Evidence" className="max-w-full max-h-full object-contain shadow-2xl" referrerPolicy="no-referrer" />
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
