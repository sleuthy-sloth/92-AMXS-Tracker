import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Grid, 
  List, 
  MoreVertical, 
  ChevronDown, 
  History as HistoryIcon, 
  UploadCloud, 
  FileSpreadsheet, 
  FileText, 
  X, 
  Camera, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert, 
  ShieldCheck, 
  Wrench, 
  ChevronRight, 
  Send, 
  Trash2 
} from 'lucide-react';
import { serverTimestamp, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, getDocs, deleteDoc, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceLog, DIFMLog, ShiftType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_LOGS, MOCK_DIFM, SHIFT_TIMES } from '../mockData';
import { cn, tsToDate, tsToMillis } from '../lib/utils';
import { createNotification } from '../services/notificationService';
import { scanMaintenanceForm, scanLogBook } from '../services/ocrService';
import { 
  exportLogsToCSV, 
  exportLogsToPDF, 
  exportTurnoverToPDF 
} from '../lib/exportUtils';

export const MaintenanceLogs: React.FC = () => {
  const { user, profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [difm, setDifm] = useState<DIFMLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tail_number: '',
    jcn: '',
    discrepancy: '',
    repair: '',
    doc_number: '',
    personnelInput: '',
    isRedBall: false,
    shift: 'Days' as ShiftType,
    g081Photo: ''
  });
  const [loading, setLoading] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isG081Uploading, setIsG081Uploading] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const g081InputRef = useRef<HTMLInputElement>(null);
  const bulkScanInputRef = useRef<HTMLInputElement>(null);
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<MaintenanceLog | null>(null);
  const [isArchiveView, setIsArchiveView] = useState(false);
  const [originalLogState, setOriginalLogState] = useState<MaintenanceLog | null>(null);

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const isLeadership = profile.role === 'leadership';
      const filteredMockLogs = MOCK_LOGS.filter(log => {
        if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
        if (profile.amuId !== 'ALL' && log.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && log.shopId !== profile.shopId) return false;
        return true;
      });
      setLogs(filteredMockLogs);

      const filteredMockDifm = MOCK_DIFM.filter(d => {
        if (isLeadership && profile.amuId === 'ALL' && profile.shopId === 'ALL') return true;
        if (profile.amuId !== 'ALL' && d.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && d.shopId !== profile.shopId) return false;
        return true;
      });
      setDifm(filteredMockDifm);
      return;
    }

    const logConstraints: any[] = [where('isDemo', '==', false), orderBy('timestamp', 'desc')];
    if (profile.amuId !== 'ALL') logConstraints.push(where('amuId', '==', profile.amuId));
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') logConstraints.push(where('shopId', '==', profile.shopId));
    
    const logConstraintsWithArchive: any[] = [...logConstraints, where('isArchived', '==', isArchiveView), limit(500)];
    const qLogs = query(collection(db, 'logs'), ...logConstraintsWithArchive);
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));

    let qDifm;
    const difmConstraints: any[] = [where('isDemo', '==', false)];
    if (profile.amuId !== 'ALL') difmConstraints.unshift(where('amuId', '==', profile.amuId));
    if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') difmConstraints.unshift(where('shopId', '==', profile.shopId));
    qDifm = query(collection(db, 'difm'), ...difmConstraints, limit(500));

    const unsubDifm = onSnapshot(qDifm, (snap) => {
      setDifm(snap.docs.map(d => ({ id: d.id, ...d.data() } as DIFMLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'difm'));

    return () => {
      unsubLogs();
      unsubDifm();
    };
  }, [profile, isDemoMode, isArchiveView]);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const result = await scanMaintenanceForm(base64);
      if (result) {
        setFormData(prev => ({
          ...prev,
          tail_number: result.tail_number || prev.tail_number,
          discrepancy: result.discrepancy || prev.discrepancy,
          repair: result.repair || prev.repair,
          jcn: result.jcn || prev.jcn,
          doc_number: result.doc_number || prev.doc_number
        }));
      }
    } catch (error) {
      console.error("Scanning failed:", error);
      alert("Failed to parse form. Please try a clearer picture.");
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleScanLogbook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert("Please select a specific AMU and Shop before bulk scanning logbooks.");
      return;
    }

    setIsBulkScanning(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const results = await scanLogBook(base64);
      if (results && results.length > 0) {
        if (!window.confirm(`Found ${results.length} maintenance entries. Import them all into ${profile.amuId} AMU - ${profile.shopId} Shop?`)) {
          return;
        }

        const batch = results.map(result => ({
          tail_number: result.tail_number || 'UNKNOWN',
          jcn: result.jcn || '',
          discrepancy: result.discrepancy,
          repair: result.repair,
          shopId: profile.shopId,
          amuId: profile.amuId,
          technician_name: profile.name,
          man_number: profile.man_number,
          shift: 'Days' as ShiftType,
          timestamp: serverTimestamp(),
          isDemo: isDemoMode,
          isRedBall: false
        }));

        if (isDemoMode) {
          const mockEntries = batch.map((b, i) => ({
            id: `bulk-mock-${Date.now()}-${i}`,
            ...b
          } as MaintenanceLog));
          setLogs(prev => [...mockEntries, ...prev]);
          alert(`Successfully imported ${results.length} entries.`);
        } else {
          const settled = await Promise.allSettled(
            batch.map(entry => addDoc(collection(db, 'logs'), entry))
          );
          const succeeded = settled.filter(s => s.status === 'fulfilled').length;
          const failed = settled.length - succeeded;
          if (failed > 0) {
            settled.forEach((s, i) => {
              if (s.status === 'rejected') {
                console.error(`Bulk import entry ${i} failed:`, s.reason);
              }
            });
            alert(`Imported ${succeeded} of ${settled.length} entries. ${failed} failed — see console for details.`);
          } else {
            alert(`Successfully imported ${succeeded} entries.`);
          }
        }
      } else {
        alert("No clear maintenance entries found in the image. Please try a clearer picture of the logbook.");
      }
    } catch (error) {
      console.error("Bulk scanning failed:", error);
      handleFirestoreError(error, OperationType.CREATE, 'logs/bulk');
    } finally {
      setIsBulkScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleG081Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsG081Uploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, g081Photo: reader.result as string }));
      setIsG081Uploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert('Operational entries must be assigned to a specific AMU and Shop. Please select a specific assignment in the sidebar before submitting.');
      return;
    }
    if (user?.uid === 'mock-user-preview') {
      alert('Demo users cannot modify the live database. This entry will not be saved.');
      setIsModalOpen(false);
      return;
    }

    setLoading(true);
    
    // Conflict Detection Logic
    if (editingLogId && originalLogState) {
      const latestVersion = logs.find(l => l.id === editingLogId);
      if (latestVersion && latestVersion.lastEditedAt && originalLogState.lastEditedAt) {
        const latestTime = tsToMillis(latestVersion.lastEditedAt);
        const originalTime = tsToMillis(originalLogState.lastEditedAt);
        
        if (latestTime > originalTime) {
          const proceed = window.confirm(
            `CONFLICT DETECTED: This log was edited by ${latestVersion.lastEditedBy} while you were working. \n\n` +
            `Their changes: "${latestVersion.repair.slice(0, 100)}..."\n\n` +
            `Click OK to overwrite their changes with yours, or Cancel to review the current log.`
          );
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }
    }

    const personnelArray = formData.personnelInput.split(',').map(p => p.trim()).filter(p => p);
    
    try {
      if (editingLogId) {
        await updateDoc(doc(db, 'logs', editingLogId), {
          tail_number: formData.tail_number,
          jcn: formData.jcn,
          discrepancy: formData.discrepancy,
          repair: formData.repair,
          doc_number: formData.doc_number,
          isRedBall: formData.isRedBall,
          personnel: personnelArray,
          shift: formData.shift,
          g081_photo: formData.g081Photo || null,
          lastEditedBy: profile.name,
          lastEditedAt: serverTimestamp()
        });
      } else {
        const newLog: MaintenanceLog = {
          tail_number: formData.tail_number,
          jcn: formData.jcn,
          discrepancy: formData.discrepancy,
          repair: formData.repair,
          doc_number: formData.doc_number,
          isRedBall: formData.isRedBall,
          shopId: profile.shopId,
          amuId: profile.amuId,
          technician_name: profile.name,
          man_number: profile.man_number,
          personnel: personnelArray,
          shift: formData.shift,
          timestamp: serverTimestamp(),
          isDemo: isDemoMode,
          isArchived: false,
          g081_photo: formData.g081Photo || null,
          ...(formData.g081Photo ? { g081_status: 'pending' as const } : {}),
        };
        const docRef = await addDoc(collection(db, 'logs'), newLog);

        if (formData.isRedBall && !isDemoMode) {
          await createNotification({
            shopId: profile.shopId,
            type: 'red-ball',
            title: 'RED BALL ALERT',
            message: `${formData.tail_number}: ${formData.discrepancy.slice(0, 50)}...`,
            metadata: { logId: docRef.id, tail_number: formData.tail_number }
          });
        }
      }
      setIsModalOpen(false);
      setEditingLogId(null);
      setOriginalLogState(null);
      setFormData({ tail_number: '', jcn: '', discrepancy: '', repair: '', doc_number: '', personnelInput: '', isRedBall: false, shift: 'Days', g081Photo: '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Failed to ${editingLogId ? 'update' : 'create'} log: ${message}`);
      handleFirestoreError(error, editingLogId ? OperationType.UPDATE : OperationType.CREATE, 'logs');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (log: MaintenanceLog) => {
    setFormData({
      tail_number: log.tail_number,
      jcn: log.jcn || '',
      discrepancy: log.discrepancy,
      repair: log.repair,
      doc_number: log.doc_number || '',
      personnelInput: log.personnel?.join(', ') || '',
      isRedBall: log.isRedBall || false,
      shift: log.shift || 'Days',
      g081Photo: log.g081_photo || ''
    });
    setEditingLogId(log.id!);
    setOriginalLogState(log);
    setSelectedLog(null);
    setIsModalOpen(true);
  };

  const handleDeleteLog = async (logId: string) => {
    if (isDemoMode) return;
    if (!window.confirm('Are you sure you want to delete this log? This action is irreversible.')) return;
    try {
      await deleteDoc(doc(db, 'logs', logId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'logs');
    }
  };

  const handleArchiveLog = async (logId: string, archive: boolean) => {
    if (isDemoMode) return;
    try {
      await updateDoc(doc(db, 'logs', logId), {
        isArchived: archive,
        archivedAt: archive ? serverTimestamp() : null
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'logs');
    }
  };

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return logs.filter((log) => {
      const matchesSearch =
        log.tail_number.toLowerCase().includes(q) ||
        log.technician_name.toLowerCase().includes(q) ||
        log.discrepancy.toLowerCase().includes(q) ||
        (log.man_number && log.man_number.includes(searchQuery)) ||
        (log.jcn && log.jcn.toLowerCase().includes(q)) ||
        (log.personnel && log.personnel.some((p) => p.toLowerCase().includes(q)));

      if (!matchesSearch) return false;

      if (start || end) {
        const logDate = tsToDate(log.timestamp);
        if (start && logDate < start) return false;
        if (end && logDate > end) return false;
      }
      return true;
    });
  }, [logs, searchQuery, startDate, endDate]);

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
            <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">Maintenance Logs</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="tech-label text-primary font-bold">92ND AMXS</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <p className="serif-header text-sm text-slate-500 italic">Operational Readiness & Discrepancy Tracking</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* View Toggle */}
          <div className="flex bg-white border border-outline p-1.5 shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 transition-all", viewMode === 'grid' ? "bg-primary text-white" : "text-slate-400 hover:text-slate-900")}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 transition-all", viewMode === 'list' ? "bg-primary text-white" : "text-slate-400 hover:text-slate-900")}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-outline/50 mx-1"></div>
            <button 
              onClick={() => setIsArchiveView(!isArchiveView)}
              className={cn("p-2 transition-all flex items-center gap-2", isArchiveView ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-900")}
              title={isArchiveView ? "Viewing Archive" : "View Archive"}
            >
              <HistoryIcon className="w-4 h-4" />
              {isArchiveView && <span className="text-[9px] font-black uppercase tracking-tighter">Archive</span>}
            </button>
          </div>

          <div className="h-10 w-px bg-outline mx-2 hidden md:block"></div>

          {/* Action Group */}
          <div className="flex items-center gap-3 flex-1 md:flex-none">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="sleek-button flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" /> 
              <span className="font-black tracking-widest text-[11px] uppercase">New Entry</span>
            </button>

            <div className="relative">
              <button 
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className={cn(
                  "h-[48px] px-4 flex items-center gap-2 border-2 transition-all bg-white font-black text-[10px] tracking-[0.2em] uppercase",
                  isActionsOpen ? "border-primary text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <MoreVertical className="w-4 h-4" />
                <span className="hidden sm:inline">Management</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isActionsOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isActionsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsActionsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-white border border-outline shadow-2xl z-20 flex flex-col divide-y divide-outline"
                    >
                      <div className="p-4 bg-putty/20">
                        <span className="tech-label !text-[8px] text-primary">Shift Operations</span>
                      </div>
                      
                      <button 
                        onClick={() => {
                          exportTurnoverToPDF(logs, difm, profile?.shopId || 'ALL', profile?.amuId || 'ALL', 'Current');
                          setIsActionsOpen(false);
                        }}
                        className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-none bg-sidebar flex items-center justify-center">
                          <HistoryIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-black text-[10px] tracking-widest uppercase">Turnover Report</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Generate shift handover PDF</p>
                        </div>
                      </button>

                      <div className="p-4 bg-putty/20">
                        <span className="tech-label !text-[8px] text-primary">Data Import & Export</span>
                      </div>

                      <input 
                        type="file" 
                        ref={bulkScanInputRef}
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleScanLogbook}
                      />
                      <button 
                        onClick={() => {
                          bulkScanInputRef.current?.click();
                          setIsActionsOpen(false);
                        }}
                        className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-none bg-putty flex items-center justify-center">
                          <UploadCloud className="w-4 h-4 text-slate-700" />
                        </div>
                        <div>
                          <p className="font-black text-[10px] tracking-widest uppercase truncate">Bulk Logbook Scan</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Batch OCR from photos</p>
                        </div>
                      </button>

                      <div className="grid grid-cols-2">
                        <button 
                          onClick={() => exportLogsToCSV(filteredLogs, profile?.shopId || 'ALL')}
                          className="p-4 hover:bg-slate-50 flex flex-col items-center gap-2 border-r border-outline"
                        >
                          <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                          <span className="font-black text-[9px] tracking-widest uppercase">CSV</span>
                        </button>
                        <button 
                          onClick={() => exportLogsToPDF(filteredLogs, profile?.shopId || 'ALL')}
                          className="p-4 hover:bg-slate-50 flex flex-col items-center gap-2"
                        >
                          <FileText className="w-5 h-5 text-slate-400" />
                          <span className="font-black text-[9px] tracking-widest uppercase">PDF</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Shift Timeline Visualization */}
      <div className="visible-grid bg-surface p-8">
        <p className="tech-label mb-6 uppercase tracking-widest">Aero-Maintenance Activity Heatmap (24H)</p>
        <div className="relative h-12 bg-background border border-outline flex items-center overflow-hidden">
          <div className="absolute inset-0 flex">
            {/* Nights 1 (0000-0700) */}
            <div className="h-full bg-slate-100 flex items-center justify-center border-r border-outline" style={{ width: '29.16%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase">Nights</span>
            </div>
            {/* Days (0700-1500) */}
            <div className="h-full bg-primary/10 flex items-center justify-center border-r border-outline" style={{ width: '33.33%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase text-primary">Days</span>
            </div>
            {/* Swings (1500-2300) */}
            <div className="h-full bg-caution-yellow/10 flex items-center justify-center border-r border-outline" style={{ width: '33.33%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase text-caution-yellow">Swings</span>
            </div>
            {/* Nights 2 (2300-2400) */}
            <div className="h-full bg-slate-100 flex items-center justify-center" style={{ width: '4.18%' }}>
              <span className="tech-label text-[9px] opacity-40 font-bold uppercase">Nights</span>
            </div>
          </div>
          <div className="absolute inset-0 flex px-2 pointer-events-none">
            {filteredLogs.slice(0, 50).map((log, i) => {
              const date = tsToDate(log.timestamp);
              const hours = date.getHours();
              const minutes = date.getMinutes();
              const left = ((hours * 60 + minutes) / (24 * 60)) * 100;
              return (
                <div 
                  key={log.id || i}
                  className={cn(
                    "absolute w-1.5 h-6 -translate-x-1/2 transition-all hover:h-8 hover:z-10 cursor-pointer pointer-events-auto",
                    log.isRedBall ? "bg-safety-orange shadow-[0_0_8px_rgba(255,103,31,0.5)]" : "bg-primary"
                  )}
                  style={{ left: `${left}%` }}
                  title={`${log.tail_number} [${log.shift}]: ${log.discrepancy}`}
                  onClick={() => setSelectedLog(log)}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-between mt-3 px-1 border-t border-outline/30 pt-4">
          <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-slate-200"></div> Nights (23-07)</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-primary/20"></div> Days (07-15)</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-caution-yellow/20"></div> Swings (15-23)</div>
          </div>
          <p className="tech-label text-[8px] opacity-40 font-mono">24H OPERATIONAL CYCLE</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-0 visible-grid bg-surface">
        <div className="flex-1 relative p-4">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant z-10" />
                <input 
                  type="text" 
                  placeholder="Search by tail, name, man#, JCN, or discrepancy..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="sleek-input pl-12 w-full !border-none !bg-transparent relative z-0"
                />
        </div>
        <div className="flex gap-0">
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Start Date</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">End Date</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="visible-grid bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                  <th className="px-8 py-5">Tail / JCN</th>
                  <th className="px-8 py-5">Date / Shift</th>
                  <th className="px-8 py-5">Personnel</th>
                  <th className="px-8 py-5">Discrepancy</th>
                  <th className="px-8 py-5">G081</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {filteredLogs.map((log, idx) => (
                  <motion.tr 
                    key={log.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="hover-invert cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-8 py-5">
                      <div className="data-mono text-sm font-black">{log.tail_number}</div>
                      <div className="tech-label text-[10px] mt-1 opacity-70 font-bold">{log.jcn || `ID: #${log.id?.slice(0, 6)}`}</div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="data-mono text-xs">
                        {log.timestamp ? format(tsToDate(log.timestamp), 'yyyy.MM.dd') : 'Pending'}
                      </div>
                      {log.shift && <span className="tech-label text-[10px] mt-1 block opacity-70 font-bold">{log.shift} Shift</span>}
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-[12px] uppercase tracking-tight text-slate-900">{log.technician_name}</p>
                      {log.personnel && log.personnel.length > 0 && (
                        <p className="tech-label text-[10px] mt-1 text-slate-500 font-bold">+{log.personnel.length} Support</p>
                      )}
                    </td>
                    <td className="px-8 py-5 max-w-xs">
                      <p className="serif-header text-xs line-clamp-2 text-slate-600">{log.discrepancy}</p>
                    </td>
                    <td className="px-8 py-5">
                      {log.g081_photo ? (
                        <div className="flex gap-2 items-center">
                          {log.g081_status === 'verified' ? (
                            <div className="w-7 h-7 rounded-none bg-emerald-100 flex items-center justify-center" title="Verified in G081">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-none bg-caution-yellow/10 flex items-center justify-center" title="G081 Proof Uploaded - Pending Review">
                              <Camera className="w-3.5 h-3.5 text-caution-yellow" />
                            </div>
                          )}
                        </div>
                      ) : <span className="tech-label !text-[8px] opacity-20">No Proof</span>}
                    </td>
                    <td className="px-8 py-5">
                      {log.isRedBall ? (
                        <span className="badge badge-danger">RED BALL</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500">NORMAL</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleEditClick(log)}
                          className="p-2 hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Wrench className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleArchiveLog(log.id!, !log.isArchived)}
                          className={cn(
                            "p-2 hover:bg-slate-100 transition-colors",
                            log.isArchived ? "text-emerald-600" : "text-amber-600"
                          )}
                          title={log.isArchived ? "Restore" : "Archive"}
                        >
                          <HistoryIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteLog(log.id!)}
                          className="p-2 hover:bg-slate-100 text-slate-400 hover:text-safety-orange transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 visible-grid bg-white">
          <AnimatePresence>
            {filteredLogs.map((log, idx) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className="p-8 flex flex-col justify-between hover:bg-putty/50 transition-colors cursor-pointer group"
                onClick={() => setSelectedLog(log)}
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="tech-label mb-1 text-slate-500">
                        {log.jcn ? `JCN: ${log.jcn}` : `ID: #${log.id?.slice(0, 6)}`}
                      </p>
                      <h3 className="text-2xl font-black tracking-tighter uppercase group-hover:text-primary transition-colors text-slate-900">{log.tail_number}</h3>
                    </div>
                    {log.isRedBall && (
                      <span className="badge badge-danger">Red Ball</span>
                    )}
                    {log.g081_photo && (
                      <div className={cn(
                        "badge flex items-center gap-1.5 ml-2",
                        log.g081_status === 'verified' ? "bg-emerald-50 text-emerald-600" : "bg-caution-yellow/10 text-caution-yellow"
                      )}>
                        {log.g081_status === 'verified' ? <ShieldCheck className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                        <span className="uppercase tracking-widest text-[8px]">{log.g081_status === 'verified' ? 'G081' : 'Upload'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-outline pb-2">
                      <span className="tech-label !text-[9px]">Lead Tech</span>
                      <span className="font-black text-[10px] uppercase tracking-tight">
                        {log.technician_name}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-outline pb-2">
                      <span className="tech-label !text-[9px]">Timestamp</span>
                      <span className="data-mono text-[10px]">
                        {log.timestamp ? format(tsToDate(log.timestamp), 'yyyy.MM.dd') : 'Pending'}
                        {log.shift && <span className="ml-2 opacity-60">[{log.shift} {SHIFT_TIMES[log.shift]}]</span>}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="tech-label !text-[9px] text-primary">Discrepancy</span>
                      <p className="serif-header text-sm leading-relaxed line-clamp-3">{log.discrepancy}</p>
                    </div>
                  </div>
                </div>
                
                <div className="tech-label !text-[9px] text-primary group-hover:translate-x-1 transition-transform flex items-center gap-2">
                  View Details <ChevronRight className="w-3 h-3" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Log Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-2xl w-full rounded-none shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-8 border-b border-outline flex justify-between items-center bg-putty/30">
                <div>
                  <h3 className="font-black text-3xl tracking-tighter uppercase">{selectedLog.tail_number}</h3>
                  <p className="tech-label mt-1 opacity-60">
                    {selectedLog.jcn ? `JCN: ${selectedLog.jcn}` : `Log ID: #${selectedLog.id?.slice(0, 6)}`}
                  </p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-100 transition-colors text-slate-900">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                    <span className="tech-label">Primary Technician</span>
                    <p className="font-black text-sm uppercase tracking-tight">{selectedLog.technician_name}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="tech-label">Date Logged</span>
                    <p className="data-mono text-sm">
                      {selectedLog.timestamp ? format(tsToDate(selectedLog.timestamp), 'MMMM dd, yyyy HH:mm') : 'Pending'}
                      {selectedLog.shift && <span className="ml-3 tech-label !text-[8px] bg-putty px-2 py-1">{selectedLog.shift} ({SHIFT_TIMES[selectedLog.shift]})</span>}
                    </p>
                  </div>
                </div>

                {selectedLog.personnel && selectedLog.personnel.length > 0 && (
                  <div className="space-y-3">
                    <span className="tech-label">Additional Personnel</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedLog.personnel.map((p, i) => (
                        <span key={i} className="px-3 py-1.5 bg-putty text-[10px] font-black uppercase tracking-widest">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="p-6 bg-safety-orange/5 border-l-4 border-safety-orange">
                    <span className="tech-label text-safety-orange flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-3 h-3" /> Discrepancy
                    </span>
                    <p className="serif-header text-base leading-relaxed text-on-surface">{selectedLog.discrepancy}</p>
                  </div>
                  <div className="p-6 bg-primary/5 border-l-4 border-primary">
                    <span className="tech-label text-primary flex items-center gap-2 mb-3">
                      <Wrench className="w-3 h-3" /> Repair Action
                    </span>
                    <p className="text-sm leading-relaxed text-on-surface font-medium">{selectedLog.repair}</p>
                  </div>
                </div>

                {selectedLog.doc_number && (
                  <div className="space-y-2">
                    <span className="tech-label">Document Number</span>
                    <p className="data-mono text-base text-primary font-black">{selectedLog.doc_number}</p>
                  </div>
                )}

                {selectedLog.g081_photo && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="tech-label">G081 Screen Proof</span>
                      {selectedLog.g081_status === 'verified' && (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="tech-label !text-emerald-600">Verified by {selectedLog.g081_verified_by}</span>
                        </div>
                      )}
                    </div>
                    <div className="border border-outline p-2 bg-putty/10">
                      <img src={selectedLog.g081_photo} alt="G081 Proof" className="w-full h-auto max-h-96 object-contain" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-8 border-t border-outline bg-slate-50 flex justify-between items-center">
                <div className="tech-label !text-[8px] opacity-50">
                  {selectedLog.lastEditedBy && (
                    <span>Last edited by {selectedLog.lastEditedBy} {selectedLog.lastEditedAt && `on ${format(tsToDate(selectedLog.lastEditedAt), 'MM/dd HH:mm')}`}</span>
                  )}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      handleArchiveLog(selectedLog.id!, !selectedLog.isArchived);
                      setSelectedLog(null);
                    }}
                    className={cn(
                      "sleek-button border",
                      selectedLog.isArchived 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                        : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                    )}
                  >
                    {selectedLog.isArchived ? 'Restore' : 'Archive'}
                  </button>
                  <button 
                    onClick={() => {
                      handleDeleteLog(selectedLog.id!);
                      setSelectedLog(null);
                    }}
                    className="sleek-button bg-safety-orange/10 !text-safety-orange border border-safety-orange/30 hover:bg-safety-orange/20"
                  >
                    Delete Record
                  </button>
                  <button 
                    onClick={() => handleEditClick(selectedLog)}
                    className="sleek-button bg-white !text-on-surface border border-outline hover:bg-putty"
                  >
                    Edit Entry
                  </button>
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="sleek-button px-10"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entry Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-2xl w-full max-h-[90vh] rounded-none shadow-2xl flex flex-col border border-outline"
            >
              <div className="p-8 border-b border-outline flex justify-between items-center bg-putty/30 shrink-0">
                <h3 className="font-black text-2xl tracking-tighter uppercase">{editingLogId ? 'Edit Maintenance Entry' : 'New Maintenance Entry'}</h3>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    ref={scanInputRef}
                    className="hidden" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleScan}
                  />
                  <button 
                    type="button"
                    onClick={() => scanInputRef.current?.click()}
                    className="sleek-button bg-primary !text-white flex items-center gap-2 py-2"
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Scan Form</span>
                  </button>
                  <button onClick={() => { setIsModalOpen(false); setEditingLogId(null); }} className="p-2 hover:bg-putty transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Tail Number</label>
                    <input 
                      required
                      className="sleek-input w-full"
                      placeholder="AF-00-0000"
                      value={formData.tail_number}
                      onChange={e => setFormData({...formData, tail_number: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">JCN (Job Control Number)</label>
                    <input 
                      className="sleek-input w-full"
                      placeholder="E.G. 231450012"
                      value={formData.jcn}
                      onChange={e => setFormData({...formData, jcn: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="tech-label !text-[9px]">Additional Personnel (Comma Separated)</label>
                  <input 
                    className="sleek-input w-full"
                    placeholder="E.G. Smith J, Doe A"
                    value={formData.personnelInput}
                    onChange={e => setFormData({...formData, personnelInput: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Priority Status</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, isRedBall: !formData.isRedBall})}
                      className={cn(
                        "sleek-input w-full flex items-center justify-center gap-3 transition-colors",
                        formData.isRedBall ? "bg-safety-orange text-white border-safety-orange font-black" : "bg-putty/30 text-on-surface-variant"
                      )}
                    >
                      <ShieldAlert className="w-4 h-4" /> {formData.isRedBall ? 'RED BALL' : 'NORMAL'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Shift Assignment</label>
                    <select 
                      className="sleek-input w-full"
                      value={formData.shift}
                      onChange={e => setFormData({...formData, shift: e.target.value as ShiftType})}
                    >
                      {Object.entries(SHIFT_TIMES).map(([shift, time]) => (
                        <option key={shift} value={shift}>
                          {shift} ({time})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Discrepancy Report</label>
                    <textarea 
                      required
                      rows={3}
                      className="sleek-input w-full resize-none serif-header"
                      placeholder="Describe the malfunction or inspection requirement..."
                      value={formData.discrepancy}
                      onChange={e => setFormData({...formData, discrepancy: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Repair Action Taken</label>
                    <textarea 
                      required
                      rows={3}
                      className="sleek-input w-full resize-none"
                      placeholder="Describe the corrective action or turnover status..."
                      value={formData.repair}
                      onChange={e => setFormData({...formData, repair: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="tech-label !text-[9px]">Document Number (Optional)</label>
                  <input 
                    className="sleek-input w-full data-mono"
                    placeholder="E.G. 92144A001"
                    value={formData.doc_number}
                    onChange={e => setFormData({...formData, doc_number: e.target.value})}
                  />
                </div>

                <div className="space-y-4">
                  <label className="tech-label !text-[9px]">G081 Screen Proof (Optional)</label>
                  <input 
                    type="file" 
                    ref={g081InputRef}
                    className="hidden" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleG081Upload}
                  />
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => g081InputRef.current?.click()}
                      className="sleek-button bg-surface border border-outline hover:bg-slate-50 flex items-center justify-center gap-3 px-6 py-3 flex-1 text-slate-700"
                      disabled={isG081Uploading}
                    >
                      {isG081Uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                      <span className="font-black text-[10px] tracking-widest uppercase">{editingLogId ? 'Update G081 Proof' : 'Upload G081 Proof'}</span>
                    </button>
                    {formData.g081Photo && (
                      <button 
                        type="button" 
                        onClick={() => setFormData({...formData, g081Photo: ''})}
                        className="p-3 text-safety-orange hover:bg-safety-orange/10 rounded-none border border-safety-orange/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {formData.g081Photo && (
                    <div className="mt-2 relative group overflow-hidden border border-outline bg-putty/20 p-2">
                       <img src={formData.g081Photo} alt="G081 Proof" className="max-h-40 w-full object-cover" referrerPolicy="no-referrer" />
                       <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="tech-label !text-white !opacity-100">Image Loaded</span>
                       </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="sleek-button w-full flex items-center justify-center gap-4 py-4 text-base"
                >
                  {loading ? 'Transmitting Data...' : 'Submit Operational Entry'} <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
