import React, { useState, useEffect, memo } from 'react';
import { Activity, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { MaintenanceLog, TrainingRecord } from '../../types';
import { useAuth } from '../../contexts/AuthContextInstance';
import { useScanStatus } from '../../contexts/AIScanStatusInstance';
import { TrendAlertsSchema } from '../../lib/aiSchemas';
import { generateJSONWithFallback } from '../../lib/aiProvider';
import { getCachedAIResult, setCachedAIResult, generateDataHash } from '../../lib/aiCache';
import { classifyError, AIRetryError } from '../../lib/aiRetry';
import { cn } from '../../lib/utils';

type IntelAlert = {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  time: string;
};

export const IntelligenceFeed: React.FC<{ logs: MaintenanceLog[]; training: TrainingRecord[] }> = memo(
  ({ logs, training }) => {
    const { profile } = useAuth();
    const { reportStart, reportSuccess, reportError } = useScanStatus();
    const [alerts, setAlerts] = useState<IntelAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const generateIntelligence = async () => {
        if (!profile) return;
        setLoading(true);
        reportStart('intelligence-feed');
        
        try {
          const recentLogs = logs
            .slice(0, 15)
            .map((l) => `${l.tail_number} (${l.isRedBall ? 'RED BALL' : 'Standard'}): ${l.discrepancy}`);
          const imminentTraining = training
            .filter((t) => t.status !== 'current')
            .slice(0, 10)
            .map((t) => `${t.course_name} for Man ${t.man_number} due ${t.due_date}`);

          if (recentLogs.length === 0 && imminentTraining.length === 0) {
            setAlerts([
              {
                id: 'no-data',
                type: 'info',
                title: 'Operation Static',
                description:
                  'Insufficient shop data for trend analysis. Analysis engine monitoring for new inputs.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
            setLoading(false);
            reportSuccess('intelligence-feed');
            return;
          }

          const currentHash = generateDataHash([...recentLogs, ...imminentTraining]);
          const cacheKey = `${profile.amuId}_${profile.shopId}`;
          
          // Check cache (1 hour max age)
          const cached = await getCachedAIResult<IntelAlert[]>('intelligence', cacheKey, 3600000);
          
          if (cached) {
            setAlerts(cached);
            setLoading(false);
            reportSuccess('intelligence-feed', 'genai-mil');
            return;
          }

          const { data, source } = await generateJSONWithFallback({
            schema: TrendAlertsSchema,
            context: 'IntelligenceFeed',
            prompt: `SYSTEM ROLE: 92nd AMXS Operational Intelligence Engine.
              MISSION: Provide forensic analysis of maintenance and training data.

              DATA SOURCE (Shop: ${profile.shopId}, AMU: ${profile.amuId}):
              Logs: ${recentLogs.join(' | ')}
              Training Due: ${imminentTraining.join(' | ')}

              TASK: Identify 1-3 significant trends or critical readiness alerts based ONLY on the provided data.
              STRICT NEGATIVE CONSTRAINT: Do NOT hallucinate or assume data. If data is sparse or shows no significant issues, return an empty array or only include factual observations (e.g. "Low volume of maintenance entries detected").

              OUTPUT: JSON array [ { "type": "critical" | "warning" | "info", "title": string, "description": string } ]`,
          });

          const finalAlerts = (!data || data.length === 0) 
            ? [{
                id: 'nominal',
                type: 'info' as const,
                title: 'System Nominal',
                description: 'No significant readiness trends or critical alerts identified from recent data blocks.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }]
            : data.map((a, i) => ({
                ...a,
                id: `intel-${i}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }));

          setAlerts(finalAlerts);
          
          // Save to cache
          await setCachedAIResult('intelligence', cacheKey, finalAlerts, currentHash);
          
          reportSuccess('intelligence-feed', source);
        } catch (err) {
          console.error('Intelligence Feed Error:', err);
          const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
          reportError('intelligence-feed', classified);
          setAlerts([
            {
              id: 'nominal',
              type: 'info',
              title: 'System Nominal',
              description: 'Operational data monitoring active. Analysis engine standby.',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } finally {
          setLoading(false);
        }
      };

      generateIntelligence();
      const interval = setInterval(generateIntelligence, 300000);
      return () => clearInterval(interval);
    }, [profile, logs, training, reportStart, reportSuccess, reportError]);

    return (
      <div className="visible-grid bg-white border border-outline h-full">
        <div className="p-6 border-b border-outline bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Mission Intelligence
            </h3>
            <p className="tech-label mt-1 text-slate-400">Live Readiness Analysis // 92 AMXS</p>
          </div>
          <Activity className={cn('w-4 h-4 text-primary', loading && 'animate-pulse')} />
        </div>
        <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
          {loading && alerts.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="flex justify-center gap-1">
                <div className="w-1.5 h-1.5 bg-primary animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <p className="tech-label text-[8px] text-slate-400 uppercase">
                Processing Field Intelligence...
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-slate-50 border-l-4 border-l-primary flex gap-4 shadow-sm"
                style={{
                  borderLeftColor:
                    alert.type === 'critical'
                      ? '#ef4444'
                      : alert.type === 'warning'
                        ? '#f59e0b'
                        : '#3b82f6',
                }}
              >
                <div
                  className={cn(
                    'w-8 h-8 flex items-center justify-center shrink-0 rounded-none',
                    alert.type === 'critical'
                      ? 'bg-red-100 text-red-600'
                      : alert.type === 'warning'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                  )}
                >
                  {alert.type === 'critical' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-[11px] font-black uppercase tracking-tight text-slate-900">
                      {alert.title}
                    </h4>
                    <span className="tech-label text-[8px] opacity-40">{alert.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed serif-header">
                    {alert.description}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }
);
IntelligenceFeed.displayName = 'IntelligenceFeed';
