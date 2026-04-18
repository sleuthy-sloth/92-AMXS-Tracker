import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  History as HistoryIcon,
  Search
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy
} from 'firebase/firestore';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, MaintenanceLog, TrainingRecord, DIFMLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAI } from '../lib/gemini';
import { safeParse, TrendAlertsSchema } from '../lib/aiSchemas';
import { cn, tsToDate } from '../lib/utils';
import { exportTurnoverToPDF } from '../lib/exportUtils';
import { MOCK_LOGS, MOCK_PERSONNEL, MOCK_TRAINING, MOCK_DIFM } from '../mockData';

const IntelligenceFeed: React.FC<{ logs: MaintenanceLog[], training: TrainingRecord[] }> = ({ logs, training }) => {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<{ id: string, type: 'critical' | 'warning' | 'info', title: string, description: string, time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateIntelligence = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        // Prepare data for analysis
        const recentLogs = logs.slice(0, 15).map(l => `${l.tail_number} (${l.isRedBall ? 'RED BALL' : 'Standard'}): ${l.discrepancy}`);
        const imminentTraining = training.filter(t => t.status !== 'current').slice(0, 10).map(t => `${t.course_name} for Man ${t.man_number} due ${t.due_date}`);
        
        if (recentLogs.length === 0 && imminentTraining.length === 0) {
          setAlerts([{
            id: 'no-data',
            type: 'info',
            title: 'Operation Static',
            description: 'Insufficient shop data for trend analysis. Analysis engine monitoring for new inputs.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          setLoading(false);
          return;
        }

        const response = await getAI().models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ 
            role: "user", 
            parts: [{ 
              text: `SYSTEM ROLE: 92nd AMXS Operational Intelligence Engine.
              MISSION: Provide forensic analysis of maintenance and training data.
              
              DATA SOURCE (Shop: ${profile.shopId}, AMU: ${profile.amuId}):
              Logs: ${recentLogs.join(' | ')}
              Training Due: ${imminentTraining.join(' | ')}
              
              TASK: Identify 1-3 significant trends or critical readiness alerts based ONLY on the provided data. 
              STRICT NEGATIVE CONSTRAINT: Do NOT hallucinate or assume data. If data is sparse or shows no significant issues, return an empty array or only include factual observations (e.g. "Low volume of maintenance entries detected").
              
              OUTPUT: JSON array [ { "type": "critical" | "warning" | "info", "title": string, "description": string } ]` 
            }] 
          }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.1 
          }
        });

        const data = safeParse(TrendAlertsSchema, response.text, "IntelligenceFeed");
        if (!data || data.length === 0) {
          setAlerts([{
            id: 'nominal',
            type: 'info',
            title: 'System Nominal',
            description: 'No significant readiness trends or critical alerts identified from recent data blocks.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        } else {
          setAlerts(data.map((a, i) => ({
            ...a,
            id: `intel-${i}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        }
      } catch (err) {
        console.error("Intelligence Feed Error:", err);
        setAlerts([{
          id: 'err',
          type: 'info',
          title: 'System Analysis Paused',
          description: 'Connection to operational intelligence engine is throttled. Monitoring manually.',
          time: '--:--'
        }]);
      } finally {
        setLoading(false);
      }
    };

    generateIntelligence();
    const interval = setInterval(generateIntelligence, 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, [profile, logs.length, training.length]);

  return (
    <div className="visible-grid bg-white border border-outline h-full">
      <div className="p-6 border-b border-outline bg-slate-50 flex justify-between items-center">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Mission Intelligence</h3>
          <p className="tech-label mt-1 text-slate-400">Live Readiness Analysis // 92 AMXS</p>
        </div>
        <Activity className={cn("w-4 h-4 text-primary", loading && "animate-pulse")} />
      </div>
      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {loading && alerts.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="flex justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-primary animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <p className="tech-label text-[8px] text-slate-400 uppercase">Processing Field Intelligence...</p>
          </div>
        ) : (
          alerts.map(alert => (
            <motion.div 
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-slate-50 border-l-4 border-l-primary flex gap-4 shadow-sm"
              style={{ borderLeftColor: alert.type === 'critical' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6' }}
            >
              <div className={cn(
                "w-8 h-8 flex items-center justify-center shrink-0 rounded-none",
                alert.type === 'critical' ? "bg-red-100 text-red-600" : alert.type === 'warning' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
              )}>
                {alert.type === 'critical' ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-[11px] font-black uppercase tracking-tight text-slate-900">{alert.title}</h4>
                  <span className="tech-label text-[8px] opacity-40">{alert.time}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed serif-header">{alert.description}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [difm, setDifm] = useState<DIFMLog[]>([]);

  useEffect(() => {
    if (!profile) return;

    if (isDemoMode) {
      const filteredMockLogs = MOCK_LOGS.filter(l => {
        if (profile.amuId !== 'ALL' && l.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && l.shopId !== profile.shopId) return false;
        return true;
      }).sort((a, b) => tsToDate(b.timestamp).getTime() - tsToDate(a.timestamp).getTime());
      setLogs(filteredMockLogs);

      const filteredMockPersonnel = MOCK_PERSONNEL.filter(p => {
        if (profile.amuId !== 'ALL' && p.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && p.shopId !== profile.shopId) return false;
        return true;
      });
      setPersonnel(filteredMockPersonnel);

      const filteredMockTraining = MOCK_TRAINING.filter(t => {
        if (profile.amuId !== 'ALL' && t.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && t.shopId !== profile.shopId) return false;
        return true;
      });
      setTraining(filteredMockTraining);

      const filteredMockDifm = MOCK_DIFM.filter(d => {
        if (profile.amuId !== 'ALL' && d.amuId !== profile.amuId) return false;
        if (profile.shopId !== 'ALL' && d.shopId !== profile.shopId) return false;
        return true;
      });
      setDifm(filteredMockDifm);
      return;
    }

    let qLogs;
    if (profile.role === 'leadership' || profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      let queryRef = collection(db, 'logs');
      const constraints: any[] = [where('isDemo', '==', false), orderBy('timestamp', 'desc')];
      
      if (profile.role === 'leadership') {
        if (profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
          constraints.unshift(where('amuId', '==', profile.amuId));
        }
        if (profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
          constraints.unshift(where('shopId', '==', profile.shopId));
        }
      } else {
        if (profile.amuId !== 'ALL') constraints.unshift(where('amuId', '==', profile.amuId));
        if (profile.shopId !== 'ALL') constraints.unshift(where('shopId', '==', profile.shopId));
      }

      qLogs = query(queryRef, ...constraints);
    } else {
      qLogs = query(
        collection(db, 'logs'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId), 
        where('isDemo', '==', false),
        orderBy('timestamp', 'desc')
      );
    }
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));

    let qPersonnel;
    if (profile.role === 'leadership') {
      qPersonnel = query(
        collection(db, 'users'),
        where('isDemo', '==', false)
      );
    } else {
      qPersonnel = query(
        collection(db, 'users'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }
    
    const unsubPersonnel = onSnapshot(qPersonnel, (snap) => {
      setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    let qTraining;
    if (profile.role === 'leadership') {
      qTraining = query(
        collection(db, 'training'),
        where('isDemo', '==', false)
      );
    } else {
      qTraining = query(
        collection(db, 'training'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }
    
    const unsubTraining = onSnapshot(qTraining, (snap) => {
      setTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'training'));

    let qDifm;
    if (profile.role === 'leadership') {
      qDifm = query(collection(db, 'difm'), where('isDemo', '==', false));
    } else {
      qDifm = query(
        collection(db, 'difm'), 
        where('amuId', '==', profile.amuId),
        where('shopId', '==', profile.shopId),
        where('isDemo', '==', false)
      );
    }

    const unsubDifm = onSnapshot(qDifm, (snap) => {
      setDifm(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'difm'));

    return () => {
      unsubLogs();
      unsubPersonnel();
      unsubTraining();
      unsubDifm();
    };
  }, [profile, isDemoMode]);

  const urgentLogs = logs.filter(l => l.isRedBall).length;
  const currentTraining = training.filter(t => t.status === 'current').length;
  const totalTraining = training.length || 1;
  const readiness = Math.round((currentTraining / totalTraining) * 100);

  return (
    <div className="space-y-10">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 text-on-background">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
            <img 
              src="https://media.defense.gov/2022/Sep/29/2003087437/-1/-1/0/220929-F-AFHRA-020.JPG" 
              alt="92nd AMXS" 
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply' }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none">Command Dashboard</h2>
            <div className="flex items-center gap-2 sm:gap-3 mt-2">
              <span className="tech-label text-primary font-bold tracking-widest text-[11px]">92ND AMXS</span>
              <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
              <p className="serif-header text-sm text-slate-500 italic">Operational Readiness & Oversight</p>
            </div>
          </div>
        </div>
        <div className="flex gap-4 w-full lg:w-auto">
          <button 
            onClick={() => exportTurnoverToPDF(logs, difm, (profile as any).shopId, (profile as any).amuId, 'Days')}
            className="sleek-button flex-1 lg:flex-none bg-sidebar !text-white border border-white/10 hover:bg-slate-800 flex items-center justify-center gap-3 px-8 group"
          >
            <HistoryIcon className="w-4 h-4 text-white group-hover:scale-110 transition-transform" /> 
            <span className="font-black text-[11px] uppercase tracking-widest">Turnover Report</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 visible-grid">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:col-span-2 md:row-span-2 p-10 flex flex-col justify-between bg-surface"
        >
          <div>
            <p className="tech-label mb-2">Personnel Readiness</p>
            <h3 className="text-8xl font-black tracking-tighter text-primary">{readiness}%</h3>
          </div>
          <div className="mt-10">
            <p className="tech-label mb-4">Readiness Matrix</p>
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 100 }).map((_, i) => {
                const isActive = i < readiness;
                const isExpiring = !isActive && i < (readiness + (training.filter(t => t.status === 'expiring').length / totalTraining * 100));
                return (
                  <div 
                    key={i} 
                    className={cn(
                      "aspect-square rounded-none transition-all duration-500",
                      isActive ? "bg-primary" : (isExpiring ? "bg-caution-yellow" : "bg-outline/20")
                    )} 
                  />
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8 flex flex-col justify-between bg-surface"
        >
          <p className="tech-label">Active Logs</p>
          <div className="text-5xl font-black tracking-tighter mt-4">{logs.length}</div>
          <p className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-widest mt-2">Open Discrepancies</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-8 flex flex-col justify-between bg-surface border-l border-outline"
        >
          <p className="tech-label text-safety-orange font-bold">Red Ball Items</p>
          <div className="text-5xl font-black tracking-tighter text-safety-orange mt-4">{urgentLogs}</div>
          <p className="text-[11px] font-bold text-safety-orange/70 uppercase tracking-widest mt-2">Urgent Maintenance</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 flex flex-col justify-between bg-surface border-l border-outline"
        >
          <p className="tech-label text-caution-yellow font-bold">Expiring Training</p>
          <div className="text-5xl font-black tracking-tighter text-caution-yellow mt-4">
            {training.filter(t => t.status === 'expiring').length}
          </div>
          <p className="text-[11px] font-bold text-caution-yellow/70 uppercase tracking-widest mt-2">Due &lt; 60 Days</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-8 flex flex-col justify-between bg-surface border-l border-outline"
        >
          <p className="tech-label text-safety-orange font-bold">Overdue Training</p>
          <div className="text-5xl font-black tracking-tighter text-safety-orange mt-4">
            {training.filter(t => t.status === 'expired').length}
          </div>
          <p className="text-[11px] font-bold text-safety-orange/70 uppercase tracking-widest mt-2">Immediate Action</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <IntelligenceFeed logs={logs} training={training} />
        </div>

        <div className="lg:col-span-8">
          <div className="visible-grid bg-surface">
            <div className="p-8 flex justify-between items-center border-b border-outline">
              <div>
                <h3 className="text-2xl font-black tracking-tighter uppercase">Personnel Roster</h3>
                <p className="serif-header text-sm text-slate-600">Active duty personnel and qualification status</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input className="sleek-input pl-10 py-2 text-xs w-80 !bg-background" placeholder="Filter Roster..." />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-putty/50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono">
                    <th className="px-8 py-5">Name / Rank</th>
                    <th className="px-8 py-5">Man Number</th>
                    {profile?.role === 'leadership' && <th className="px-8 py-5">Shop</th>}
                    <th className="px-8 py-5">Role</th>
                    <th className="px-8 py-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {personnel.map((p, idx) => (
                    <motion.tr 
                      key={p.uid} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover-invert"
                    >
                      <td className="px-8 py-5">
                        <p className="font-black text-sm tracking-tight uppercase">{p.name}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant uppercase mt-0.5">{p.rank} // {p.email}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className="data-mono text-sm">{p.man_number}</span>
                      </td>
                      {profile?.role === 'leadership' && (
                        <td className="px-8 py-5">
                          <span className="tech-label">{p.shopId}</span>
                        </td>
                      )}
                      <td className="px-8 py-5">
                        <span className={cn(
                          "badge",
                          p.role === 'ncoic' ? "badge-info" : "bg-outline/30 text-on-surface-variant"
                        )}>
                          {p.role}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                          <span className="tech-label text-[10px] font-bold">Active</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
