import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Grid, 
  List, 
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
  Trash2, 
  Clock 
} from 'lucide-react';
import { serverTimestamp, collection, query, where, onSnapshot, addDoc, updateDoc, doc, limit } from 'firebase/firestore';
import { parseISO, isBefore, addDays, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TrainingRecord, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_TRAINING, MOCK_PERSONNEL } from '../mockData';
import { cn } from '../lib/utils';
import { parseTrainingReport } from '../services/ocrService';
import { exportTrainingToCSV, exportTrainingToPDF } from '../lib/exportUtils';

export const TrainingTracker: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);

  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const isTechnician = profile.role === 'technician';
      
      const filteredMockTraining = MOCK_TRAINING.filter(t => {
        if (isTechnician) return t.man_number === profile.man_number;
        if (profile.amuId !== 'ALL' && t.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && t.shopId !== profile.shopId) return false;
        return true;
      });
      setTraining(filteredMockTraining);

      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (isTechnician) return p.man_number === profile.man_number;
        if (profile.amuId !== 'ALL' && p.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && p.shopId !== profile.shopId) return false;
        return true;
      });
      setPersonnel(filteredMockPersonnel);
      return;
    }

    const isTechnician = profile.role === 'technician';

    let qTraining;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL' || profile.role === 'leadership') {
      let queryRef = collection(db, 'training');
      const constraints: any[] = [where('isDemo', '==', false)];

      if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        constraints.push(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        constraints.push(where('shopId', '==', profile.shopId));
      }
      constraints.push(limit(1000));
      qTraining = query(queryRef, ...constraints);
    } else if (isTechnician) {
      qTraining = query(
        collection(db, 'training'),
        where('man_number', '==', profile.man_number),
        where('isDemo', '==', false),
        limit(1000)
      );
    } else {
      qTraining = query(
        collection(db, 'training'),
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false),
        limit(1000)
      );
    }
    
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingRecord)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'training'));

    let qPersonnel;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL' || profile.role === 'leadership') {
      let queryRef = collection(db, 'users');
      const constraints: any[] = [where('isDemo', '==', false)];
      
      if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        constraints.push(where('amuId', '==', profile.amuId));
      }
      if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        constraints.push(where('shopId', '==', profile.shopId));
      }
      constraints.push(limit(500));
      qPersonnel = query(queryRef, ...constraints);
    } else if (isTechnician) {
      qPersonnel = query(
        collection(db, 'users'),
        where('man_number', '==', profile.man_number),
        where('isDemo', '==', false),
        limit(500)
      );
    } else {
      qPersonnel = query(
        collection(db, 'users'),
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false),
        limit(500)
      );
    }
    
    const unsubPersonnel = onSnapshot(qPersonnel, (snap) => {
      setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubTraining();
      unsubPersonnel();
    };
  }, [profile, isDemoMode]);

  const getPersonName = (manNumber: string) => {
    const person = personnel.find(p => p.man_number === manNumber);
    return person ? person.name : 'Unknown Personnel';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert('Training reports must be synchronized to a specific AMU and Shop context. Please select a specific assignment in the sidebar before uploading.');
      return;
    }
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        
        let mimeType = file.type;
        // Fix for .xlsm which the parser might reject
        if (mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12') {
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        const results = await parseTrainingReport(base64, mimeType);
        
        // Batch upload results
        for (const record of results) {
          const dueDate = parseISO(record.due_date);
          const now = new Date();
          const expiringSoon = isBefore(dueDate, addDays(now, 60));
          const expired = isBefore(dueDate, now);
          
          let status: 'current' | 'expiring' | 'expired' = 'current';
          if (expired) status = 'expired';
          else if (expiringSoon) status = 'expiring';

          const trainingData = {
            man_number: record.man_number,
            course_name: record.course_name,
            due_date: record.due_date,
            shopId: profile.shopId,
            amuId: profile.amuId,
            status,
            isDemo: isDemoMode
          };

          await addDoc(collection(db, 'training'), trainingData);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error parsing report. Please ensure the file is a valid Excel document.');
    } finally {
      setIsUploading(false);
    }
  };

  const [notifyModal, setNotifyModal] = useState<{isOpen: boolean, type: 'email'} | null>(null);

  const openNotifyModal = (type: 'email') => {
    setNotifyModal({ isOpen: true, type });
  };

  const filteredTraining = training.filter(record => {
    const personName = getPersonName(record.man_number);
    const matchesSearch = 
      record.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.course_code && record.course_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      record.man_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      personName.toLowerCase().includes(searchQuery.toLowerCase());
      
    let matchesDate = true;
    if (startDate || endDate) {
      const recordDate = new Date(record.due_date);
      if (startDate) matchesDate = matchesDate && recordDate >= new Date(startDate);
      if (endDate) matchesDate = matchesDate && recordDate <= new Date(endDate);
    }
    
    return matchesSearch && matchesDate;
  });

  const stats = {
    current: filteredTraining.filter(t => t.status === 'current').length,
    expiring: filteredTraining.filter(t => t.status === 'expiring').length,
    expired: filteredTraining.filter(t => t.status === 'expired').length,
    total: filteredTraining.length || 1
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">Training Readiness</h2>
          <p className="serif-header text-lg mt-1 text-slate-600">Task expiration forecast and qualification oversight</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-surface border border-outline p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 transition-colors", viewMode === 'grid' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface")}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 transition-colors", viewMode === 'list' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
            <div className="flex gap-2">
              <button 
                onClick={() => openNotifyModal('email')}
                className="sleek-button flex items-center gap-2"
                title="Email Affected Users"
              >
                <Send className="w-4 h-4" /> <span className="hidden sm:inline">Email</span>
              </button>
              <button 
                onClick={() => exportTrainingToCSV(filteredTraining, profile.shopId)}
                className="sleek-button bg-surface !text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export CSV"
              >
                <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button 
                onClick={() => exportTrainingToPDF(filteredTraining, profile.shopId)}
                className="sleek-button bg-surface !text-slate-900 border border-outline hover:bg-slate-50 flex items-center gap-2"
                title="Export PDF"
              >
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-0 visible-grid bg-surface">
        <div className="flex-1 relative p-4">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Search by course name, man #, or personnel name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-12 w-full !border-none !bg-transparent"
          />
        </div>
        <div className="flex gap-0">
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Due After</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
          <div className="flex flex-col p-4 border-l border-outline">
            <span className="tech-label mb-2">Due Before</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Upload Area */}
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
          <div className="lg:col-span-12">
            <div className="visible-grid bg-surface">
              <label className="p-16 flex flex-col items-center justify-center text-center space-y-6 hover:bg-slate-50 transition-colors group cursor-pointer">
                <input type="file" className="sr-only" onChange={handleFileUpload} disabled={isUploading} />
                <div className="w-20 h-20 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  {isUploading ? <Clock className="w-10 h-10 animate-spin" /> : <UploadCloud className="w-10 h-10" />}
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase text-slate-900">
                    {isUploading ? 'Parsing Report...' : 'Synchronize Training Logs'}
                  </h3>
                  <p className="serif-header text-base max-w-lg mx-auto mt-2 text-slate-600">
                    Upload Excel (.xlsx, .xlsm) or CSV personnel training reports. The system will automatically reconcile and update qualification statuses.
                  </p>
                </div>
                <div className="sleek-button">
                  {isUploading ? 'Processing...' : 'Select Report File'}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Readiness Widgets */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-0 visible-grid bg-surface">
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <span className="tech-label text-emerald-500 font-bold">Fully Qualified</span>
              <span className="font-black text-2xl tracking-tighter text-slate-900">{Math.round((stats.current / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-50 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(stats.current / stats.total) * 100}%` }}></div>
            </div>
            <p className="tech-label text-[10px] opacity-70 text-slate-600">{stats.current} Personnel Current</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <span className="tech-label text-caution-yellow font-bold">Expiring &lt; 60 Days</span>
              <span className="font-black text-2xl tracking-tighter text-slate-900">{Math.round((stats.expiring / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-50 overflow-hidden">
              <div className="h-full bg-caution-yellow transition-all duration-1000" style={{ width: `${(stats.expiring / stats.total) * 100}%` }}></div>
            </div>
            <p className="tech-label text-[10px] opacity-70 text-slate-600">{stats.expiring} Personnel Require Scheduling</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <span className="tech-label text-safety-orange font-bold">Expired / Delinquent</span>
              <span className="font-black text-2xl tracking-tighter text-slate-900">{Math.round((stats.expired / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-50 overflow-hidden">
              <div className="h-full bg-safety-orange transition-all duration-1000" style={{ width: `${(stats.expired / stats.total) * 100}%` }}></div>
            </div>
            <p className="tech-label text-[10px] opacity-70 text-slate-600">{stats.expired} Personnel Non-Mission Capable</p>
          </div>
        </div>

        <div className="lg:col-span-12">
          {viewMode === 'list' ? (
            <div className="visible-grid bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                      <th className="px-8 py-5">Course Name</th>
                      <th className="px-8 py-5">Personnel</th>
                      {profile?.role === 'leadership' && <th className="px-8 py-5">Shop</th>}
                      <th className="px-8 py-5">Due Date</th>
                      <th className="px-8 py-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {filteredTraining.map((record, idx) => (
                      <motion.tr 
                        key={record.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.01 }}
                        className="hover-invert cursor-pointer"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <td className="px-8 py-5">
                          <p className="font-black text-sm tracking-tight uppercase text-slate-900">{record.course_name}</p>
                          {record.course_code && <p className="tech-label text-[10px] mt-1 text-slate-500">CODE: {record.course_code}</p>}
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-black text-[12px] uppercase tracking-tight text-slate-900">{getPersonName(record.man_number)}</p>
                          <p className="tech-label text-[10px] mt-1 text-slate-500">MAN#: {record.man_number}</p>
                        </td>
                        {profile?.role === 'leadership' && (
                          <td className="px-8 py-5">
                            <span className="tech-label">{record.shopId}</span>
                          </td>
                        )}
                        <td className="px-8 py-5">
                          <span className="data-mono text-xs">{record.due_date}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "badge",
                            record.status === 'current' ? "badge-success" : 
                            record.status === 'expiring' ? "badge-warning" : "badge-danger"
                          )}>
                            {record.status}
                          </span>
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
                {filteredTraining.map((record, idx) => (
                  <motion.div 
                    key={record.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.02 }}
                    className="p-8 flex flex-col justify-between hover:bg-putty/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xl font-black tracking-tighter uppercase group-hover:text-primary transition-colors leading-tight">{record.course_name}</h3>
                          {record.course_code && <p className="tech-label text-[10px] mt-1 text-slate-500 uppercase">{record.course_code}</p>}
                        </div>
                        <span className={cn(
                          "badge",
                          record.status === 'current' ? "badge-success" : 
                          record.status === 'expiring' ? "badge-warning" : "badge-danger"
                        )}>
                          {record.status}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between border-b border-outline pb-2">
                          <span className="tech-label text-[10px]">Personnel</span>
                          <span className="font-black text-[11px] uppercase tracking-tight">
                            {getPersonName(record.man_number)}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-outline pb-2">
                          <span className="tech-label text-[10px]">Due Date</span>
                          <span className="data-mono text-[11px]">{record.due_date}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="tech-label !text-[9px] text-primary group-hover:translate-x-1 transition-transform flex items-center gap-2 mt-8">
                      View Details <ChevronRight className="w-3 h-3" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-xl w-full rounded-none shadow-2xl overflow-hidden border border-outline"
            >
              <div className="p-10 border-b border-outline bg-putty/30 flex justify-between items-start">
                <div className="space-y-4">
                  <span className={cn(
                    "badge",
                    selectedRecord.status === 'current' ? "badge-success" : 
                    selectedRecord.status === 'expiring' ? "badge-warning" : "badge-danger"
                  )}>
                    {selectedRecord.status.toUpperCase()}
                  </span>
                  <h3 className="text-3xl font-black tracking-tighter uppercase leading-tight">
                    {selectedRecord.course_name}
                  </h3>
                  {selectedRecord.course_code && (
                    <p className="tech-label text-slate-500 font-black tracking-widest">{selectedRecord.course_code}</p>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 hover:bg-putty transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 space-y-10">
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Assigned Personnel</p>
                    <p className="font-black text-lg uppercase tracking-tight">{getPersonName(selectedRecord.man_number)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Man Number</p>
                    <p className="data-mono text-lg">{selectedRecord.man_number}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Due Date</p>
                    <p className="data-mono text-lg">{selectedRecord.due_date}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="tech-label !text-[9px]">Shop Assignment</p>
                    <p className="tech-label text-primary">{selectedRecord.shopId}</p>
                  </div>
                </div>

                <div className="p-6 bg-putty/30 border border-outline space-y-4">
                  <h4 className="tech-label !text-[9px] flex items-center gap-2">
                    <ShieldAlert className="w-3 h-3 text-safety-orange" /> Readiness Assessment
                  </h4>
                  <p className="serif-header text-sm leading-relaxed opacity-70">
                    {selectedRecord.status === 'current' 
                      ? "Personnel is fully qualified for this task. No immediate action required."
                      : selectedRecord.status === 'expiring'
                      ? "Qualification expires within 60 days. Schedule training session immediately to prevent mission impact."
                      : "Personnel is non-mission capable for this task. Immediate grounding or restriction from relevant operations is required."}
                  </p>
                </div>
              </div>

              <div className="p-10 border-t border-outline bg-putty/30">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="sleek-button w-full py-4"
                >
                  Close Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Modal */}
      <AnimatePresence>
        {notifyModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifyModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-surface rounded-3xl shadow-2xl overflow-hidden border border-outline flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-outline bg-putty/20 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-on-background uppercase tracking-tighter">
                    Email Notifications
                  </h3>
                  <p className="text-sm text-on-surface-variant mt-1">Send personalized training alerts</p>
                </div>
                <button 
                  onClick={() => setNotifyModal(null)}
                  className="p-2 hover:bg-putty rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-on-surface-variant" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {(() => {
                  const affectedRecords = filteredTraining.filter(t => t.status === 'expired' || t.status === 'expiring');
                  const groupedRecords = affectedRecords.reduce((acc, record) => {
                    if (!acc[record.man_number]) acc[record.man_number] = [];
                    acc[record.man_number].push(record);
                    return acc;
                  }, {} as Record<string, TrainingRecord[]>);

                  const affectedUsers = personnel.filter(p => 
                    groupedRecords[p.man_number] && p.email
                  );

                  if (affectedUsers.length === 0) {
                    return (
                      <div className="text-center py-8 text-on-surface-variant">
                        <p>No users found with missing training and valid contact info.</p>
                      </div>
                    );
                  }

                  return affectedUsers.map(user => {
                    const records = groupedRecords[user.man_number];
                    
                    let msg = `*** 92 AMXS TRAINING ALERT ***\n\n`;
                    msg += `Name: ${user.name}\n`;
                    msg += `ACTION REQUIRED: The following training items are overdue or expiring soon:\n\n`;
                    records.forEach(r => {
                      msg += `• ${r.course_name}\n`;
                      msg += `  DUE: ${r.due_date} | STATUS: ${r.status.toUpperCase()}\n\n`;
                    });
                    msg += `Please complete these items and update the tracker.`;

                    const subject = encodeURIComponent("92 AMXS Training Alert");
                    const body = encodeURIComponent(msg);
                    
                    const link = `mailto:${user.email}?subject=${subject}&body=${body}`;

                    return (
                      <div key={user.uid} className="bg-surface p-4 rounded-none border border-outline flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="flex-1">
                          <h4 className="font-bold text-on-background uppercase">{user.name}</h4>
                          <p className="text-xs text-on-surface-variant mb-2">
                            {user.email}
                          </p>
                          <div className="space-y-1">
                            {records.map(r => (
                              <div key={r.id} className="text-xs flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-none", r.status === 'expired' ? "bg-red-500" : "bg-yellow-500")}></span>
                                <span className="font-medium text-on-surface">{r.course_name}</span>
                                <span className="text-on-surface-variant">({r.due_date})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <a 
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sleek-button bg-primary text-white whitespace-nowrap"
                        >
                          Send Email
                        </a>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
