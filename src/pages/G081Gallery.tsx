import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Loader2, 
  Eye, 
  CheckCircle2, 
  ShieldCheck, 
  Check, 
  X 
} from 'lucide-react';
import { serverTimestamp, collection, query, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceLog } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const G081Gallery: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    
    // In demo mode, we just show empty or mock data
    if (isDemoMode) {
      setLogs([]);
      setLoading(false);
      return;
    }

    // Query for all logs with photos
    const q = query(
      collection(db, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Filter in memory for photos to avoid immediate index requirement
      setLogs(allLogs.filter(log => log.g081_photo));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });
    return unsubscribe;
  }, [profile, isDemoMode]);

  const handleVerify = async (logId: string) => {
    if (isDemoMode) {
      alert('Action not available in demo mode.');
      return;
    }
    try {
      await updateDoc(doc(db, 'logs', logId), {
        g081_status: 'verified',
        g081_verified_by: profile?.name,
        g081_verified_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logs');
    }
  };

  return (
    <div className="space-y-10">
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {logs.map((log) => (
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
                        <p className="tech-label text-slate-400 !text-[8px] mt-1">{log.technician_name} • {format(log.timestamp?.toDate ? log.timestamp.toDate() : new Date(), 'MMM dd, HH:mm')}</p>
                      </div>
                      <span className="px-2 py-1 bg-putty text-[9px] font-black uppercase tracking-widest">{log.shopId}</span>
                    </div>

                    <div className="p-3 bg-slate-50 border-l-2 border-slate-200">
                      <p className="text-xs text-slate-600 line-clamp-2 italic">"{log.discrepancy}"</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-outline flex items-center justify-between">
                    {log.g081_status === 'verified' ? (
                      <div className="flex items-center gap-3 text-emerald-600">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
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
                        className="sleek-button w-full bg-sidebar !text-white flex items-center justify-center gap-3 py-3 group hover:scale-[1.02]"
                      >
                        <Check className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="font-black text-[11px] tracking-widest uppercase text-white">React: G081 Good</span>
                      </button>
                    )}
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
