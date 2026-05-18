import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  X,
  Send
} from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContextInstance';
import { useScanStatus } from '../contexts/AIScanStatusInstance';
import { MOCK_LOGS, MOCK_DIFM, MOCK_TRAINING } from '../mockData';
import { cn, tailMatchesSearch } from '../lib/utils';
import { isGenAIMilConfigured } from '../lib/gemini';
import { withRetry, classifyError, AIRetryError } from '../lib/aiRetry';
import {
  generateTextWithOpenRouter,
  isGeminiOnCooldown,
  isOpenRouterConfigured,
  markGeminiExhausted,
  runGenAIMilWithTools,
  runOpenRouterWithTools,
  shouldFallback,
  type OpenRouterToolSchema,
} from '../lib/aiProvider';

const chatStorageKey = (uid?: string) => (uid ? `amxs-ai-chat:${uid}` : null);

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const loadPersistedMessages = (uid?: string): ChatMessage[] => {
  const key = chatStorageKey(uid);
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ChatMessage[];
    return [];
  } catch {
    return [];
  }
};

// Tools defined in OpenAI JSON Schema format (lowercase types)
const maintenanceTools: OpenRouterToolSchema[] = [
  {
    name: 'query_maintenance_logs',
    description: 'Query aircraft maintenance logs for discrepancies, repairs, and tail number history.',
    parameters: {
      type: 'object',
      properties: {
        tail_number: { type: 'string', description: 'Filter by specific tail number (e.g. 58-0092)' },
        shift: { type: 'string', enum: ['Days', 'Swings', 'Nights'], description: 'Filter by shift' },
        isRedBall: { type: 'boolean', description: 'If true, only returns urgent red ball maintenance' },
      },
    },
  },
  {
    name: 'query_difm_inventory',
    description: 'Check status of parts due-in from maintenance (DIFM).',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['due-in', 'awaiting-parts', 'in-repair', 'complete'] },
        tail_number: { type: 'string' },
      },
    },
  },
  {
    name: 'query_training_compliance',
    description: 'Identify technicians with expiring or overdue training requirements.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['expiring', 'expired'], description: 'Filter for specific compliance issues' },
        course_code: { type: 'string', description: 'Filter for a specific training course' },
      },
    },
  },
];

export const MaintenanceAssistant: React.FC = () => {
  const { user, profile, isDemoMode } = useAuth();
  const { reportStart, reportSuccess, reportError } = useScanStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedMessages(user?.uid));
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  useEffect(() => {
    const key = chatStorageKey(user?.uid);
    if (!key || typeof window === 'undefined') return;
    try {
      if (messages.length === 0) {
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, JSON.stringify(messages));
      }
    } catch {
      // sessionStorage quota/availability issues — non-fatal
    }
  }, [messages, user?.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsThinking(true);

    if (!isGenAIMilConfigured() && !isOpenRouterConfigured()) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'SYSTEM OFFLINE: No AI provider configured. Set `GENAI_MIL_API_KEY` in `.env` (dev) or the `GENAI_MIL_API_KEY` repository secret (prod build) and redeploy.'
      }]);
      setIsThinking(false);
      return;
    }

    // Shared tool executor — invoked by either GenAI.mil's function-call
    // pipeline or OpenRouter's fallback tools pipeline.
    const executeToolCall = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      if (isDemoMode) {
        if (name === 'query_maintenance_logs') {
          const a = args as { tail_number?: string; shift?: string; isRedBall?: boolean };
          return MOCK_LOGS.filter(l => {
            if (a.tail_number && l.tail_number !== a.tail_number) return false;
            if (a.shift && l.shift !== a.shift) return false;
            if (a.isRedBall && !l.isRedBall) return false;
            return true;
          }).slice(0, 10);
        }
        if (name === 'query_difm_inventory') {
          const a = args as { status?: string; tail_number?: string };
          return MOCK_DIFM.filter(d => {
            if (a.status && d.status !== a.status) return false;
            if (a.tail_number && d.tail_number !== a.tail_number) return false;
            return true;
          }).slice(0, 10);
        }
        if (name === 'query_training_compliance') {
          const a = args as { status?: string; course_code?: string };
          return MOCK_TRAINING.filter(t => {
            if (a.status && t.status !== a.status) return false;
            if (a.course_code && t.course_code !== a.course_code) return false;
            return true;
          }).slice(0, 10);
        }
        return [];
      }

      const collectionName =
        name === 'query_maintenance_logs' ? 'logs' :
        name === 'query_difm_inventory' ? 'difm' :
        name === 'query_training_compliance' ? 'training' : null;
      if (!collectionName) return [];

      let q = query(collection(db, collectionName), where('isDemo', '==', false), limit(100));
      if (profile?.shopId && profile.shopId !== 'ALL' && profile.shopId !== 'LEADERSHIP') {
        q = query(q, where('shopId', '==', profile.shopId));
      }
      if (profile?.amuId && profile.amuId !== 'ALL' && profile.amuId !== 'NONE') {
        q = query(q, where('amuId', '==', profile.amuId));
      }
      const a = args as {
        tail_number?: string;
        status?: string;
        shift?: string;
        isRedBall?: boolean;
        course_code?: string;
      };

      if (a.status && collectionName !== 'logs') q = query(q, where('status', '==', a.status));
      if (a.shift && collectionName === 'logs') q = query(q, where('shift', '==', a.shift));
      if (a.isRedBall && collectionName === 'logs') q = query(q, where('isRedBall', '==', true));
      if (a.course_code && collectionName === 'training') q = query(q, where('course_code', '==', a.course_code));

      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return results.filter(d => {
        if (a.tail_number && !tailMatchesSearch((d as any).tail_number, a.tail_number)) return false;
        return true;
      }).slice(0, 20);
    };

    const systemPrompt =
      'You are the 92nd AMXS Maintenance Assistant. ' +
      'Answer questions about aircraft maintenance, squadron operations, training programs, ' +
      'parts/supply workflows, procedures, and concepts. ' +
      'When the user asks for concrete records (logs for a tail, DIFM status, training gaps), ' +
      'call the appropriate tool to pull live data. ' +
      'When the user asks a general or conceptual question, answer from your own knowledge. ' +
      'Be concise, practical, and military-technical when relevant. ' +
      'Bold RED BALLS and EXPIRED training. Use markdown tables for record-style data.';

    // Backup-channel runner — OpenRouter with tools first, plain text if
    // the free-tier model bungles tool-calling. Returns true on success.
    const runBackupChannel = async (): Promise<boolean> => {
      if (!isOpenRouterConfigured()) return false;
      const backupSystemPrompt =
        systemPrompt +
        ' The primary AI (GenAI.mil) is temporarily unavailable. ' +
        'You have access to tools — use them for concrete record queries.';
      try {
        const toolsText = await runOpenRouterWithTools({
          systemPrompt: backupSystemPrompt,
          userPrompt: userMsg,
          tools: maintenanceTools,
          executeToolCall,
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: toolsText,
        }]);
        reportSuccess('assistant', 'openrouter');
        return true;
      } catch (toolsErr) {
        console.warn('OpenRouter tool-calling failed, trying plain text:', toolsErr);
      }
      try {
        const plainText = await generateTextWithOpenRouter({
          systemPrompt: backupSystemPrompt + ' Tools are temporarily unavailable — answer from your own knowledge only.',
          userPrompt: userMsg,
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: plainText,
        }]);
        reportSuccess('assistant', 'openrouter');
        return true;
      } catch (textErr) {
        console.error('OpenRouter plain-text fallback failed:', textErr);
        return false;
      }
    };

    reportStart('assistant');

    // If primary is in cooldown from a recent quota/lock hit, skip it and go
    // straight to OpenRouter — no point burning retry backoff.
    if (isGeminiOnCooldown() && isOpenRouterConfigured()) {
      const ok = await runBackupChannel();
      if (ok) {
        setIsThinking(false);
        return;
      }
    }

    if (isGenAIMilConfigured()) {
      try {
        const text = await withRetry(() =>
          runGenAIMilWithTools({
            systemPrompt,
            userPrompt: userMsg,
            tools: maintenanceTools,
            executeToolCall,
          })
        );
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        reportSuccess('assistant');
        setIsThinking(false);
        return;
      } catch (err) {
        console.error('GenAI.mil Assistant Error:', err);
        const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
        markGeminiExhausted(err);

        if (shouldFallback(err) && isOpenRouterConfigured()) {
          const ok = await runBackupChannel();
          if (ok) {
            setIsThinking(false);
            return;
          }
        }

        reportError('assistant', classified);
        const friendly =
          classified.kind === 'quota' || classified.kind === 'rate_limit'
            ? `Maintenance Terminal: Primary AI (GenAI.mil) is temporarily rate-limited or locked. ${isOpenRouterConfigured() ? 'The backup channel also failed.' : 'No backup channel (OpenRouter) is configured.'} Check the console for an unlock URL if the key is locked.`
            : `Assistant unavailable: ${classified.message}`;
        setMessages(prev => [...prev, { role: 'assistant', content: friendly }]);
        setIsThinking(false);
        return;
      }
    }

    // GenAI.mil not configured — try OpenRouter directly
    const ok = await runBackupChannel();
    if (!ok) {
      reportError('assistant', { kind: 'auth', message: 'No AI provider configured', retryable: false });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'SYSTEM OFFLINE: No AI provider configured.',
      }]);
    }
    setIsThinking(false);
  };

  return (
    <div className="fixed bottom-8 right-8 z-[1000]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-0 w-[400px] h-[600px] bg-white visible-grid shadow-2xl overflow-hidden flex flex-col border border-outline"
          >
            {/* Header */}
            <div className="p-6 bg-sidebar border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-none border border-primary/30">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-white tracking-widest">Maintenance Terminal</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-tighter">Secure Link Active // Intelligence Feed</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div
              ref={scrollRef}
              className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
                  <Sparkles className="w-8 h-8 text-primary/30" />
                  <div>
                    <p className="tech-label text-slate-400">Analysis Engine Ready</p>
                    <p className="serif-header text-sm text-slate-500 mt-2">
                      Ask about maintenance trends, tail number history, or shop training readiness.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full mt-4">
                    {["Identify recurring tail number issues", "Check training gaps for next 30 days"].map(q => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); }}
                        className="text-left p-3 text-[10px] font-black uppercase tracking-tight bg-white border border-outline hover:border-primary/40 transition-colors"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn(
                  "flex flex-col max-w-[85%]",
                  m.role === 'user' ? "ml-auto items-end" : "items-start"
                )}>
                  <span className="tech-label !text-[8px] mb-1 opacity-40 uppercase">
                    {m.role === 'user' ? 'Operator' : 'AMXS-AI'}
                  </span>
                  <div className={cn(
                    "p-4 text-sm leading-relaxed",
                    m.role === 'user'
                      ? "bg-primary text-white font-medium shadow-lg"
                      : "bg-white border border-outline text-slate-900 serif-header shadow-sm markdown-body"
                  )}>
                    {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex flex-col items-start max-w-[85%]">
                  <span className="tech-label !text-[8px] mb-1 opacity-40 uppercase">AMXS-AI</span>
                  <div className="p-4 bg-white border border-outline text-slate-900 flex items-center gap-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-primary animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-primary animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                    <span className="tech-label !text-[9px] text-slate-400 animate-pulse uppercase">Processing Intelligence...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-6 bg-white border-t border-outline">
              <div className="flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Analyze logs via natural language..."
                  className="flex-1 sleek-input text-xs bg-slate-50"
                  disabled={isThinking}
                />
                <button
                  disabled={isThinking || !input.trim()}
                  className="p-3 bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-none flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all border-2 backdrop-blur-md relative group",
          isOpen
            ? "bg-white border-primary text-primary"
            : "bg-sidebar/95 border-white/20 text-white"
        )}
        title="AI Maintenance Assistant"
      >
        <div className={cn(
          "w-10 h-10 flex items-center justify-center transition-all",
          isOpen ? "bg-primary text-white" : "bg-white/10 text-white group-hover:bg-primary/20"
        )}>
          {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
        </div>

        {/* Technical Label */}
        <div className="absolute right-full mr-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap hidden md:block">
          <div className="bg-sidebar text-white px-3 py-1.5 border border-white/10 flex flex-col items-end">
            <span className="tech-label !text-[6px] text-primary">AMXS-INTEL</span>
            <span className="font-black text-[9px] uppercase tracking-widest leading-none mt-1">AI Assistant Terminal</span>
          </div>
        </div>

        {/* Status Light */}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 flex">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </div>
        )}
      </motion.button>
    </div>
  );
};
