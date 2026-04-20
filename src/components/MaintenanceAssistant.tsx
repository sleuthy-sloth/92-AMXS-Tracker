import React, { useState, useEffect, useRef } from 'react';
import { Type, FunctionDeclaration } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  Sparkles, 
  X, 
  Send 
} from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useScanStatus } from '../contexts/AIScanStatusContext';
import { MOCK_LOGS, MOCK_DIFM, MOCK_TRAINING } from '../mockData';
import { cn } from '../lib/utils';
import { getAI, isGeminiConfigured } from '../lib/gemini';
import { withRetry, classifyError, AIRetryError } from '../lib/aiRetry';
import {
  generateTextWithOpenRouter,
  isGeminiOnCooldown,
  isOpenRouterConfigured,
  markGeminiExhausted,
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

  // Translate a Gemini FunctionDeclaration tree to OpenAI JSON Schema
  // (what OpenRouter expects). The enum is UPPERCASE in Gemini's SDK
  // (Type.STRING = 'STRING'), lowercase in JSON Schema ('string').
  const toOpenAISchema = (node: unknown): Record<string, unknown> => {
    if (!node || typeof node !== 'object') return {};
    const n = node as Record<string, unknown>;
    const out: Record<string, unknown> = { ...n };
    if (typeof n.type === 'string') out.type = (n.type as string).toLowerCase();
    if (n.properties && typeof n.properties === 'object') {
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n.properties as Record<string, unknown>)) {
        props[k] = toOpenAISchema(v);
      }
      out.properties = props;
    }
    if (n.items) out.items = toOpenAISchema(n.items);
    return out;
  };

  const maintenanceTools: FunctionDeclaration[] = [
    {
      name: "query_maintenance_logs",
      description: "Query aircraft maintenance logs for discrepancies, repairs, and tail number history.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          tail_number: { type: Type.STRING, description: "Filter by specific tail number (e.g. 58-0092)" },
          shift: { type: Type.STRING, enum: ['Days', 'Swings', 'Nights'], description: "Filter by shift" },
          isRedBall: { type: Type.BOOLEAN, description: "If true, only returns urgent red ball maintenance" }
        }
      }
    },
    {
      name: "query_difm_inventory",
      description: "Check status of parts due-in from maintenance (DIFM).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ['due-in', 'awaiting-parts', 'in-repair', 'complete'] },
          tail_number: { type: Type.STRING }
        }
      }
    },
    {
      name: "query_training_compliance",
      description: "Identify technicians with expiring or overdue training requirements.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ['expiring', 'expired'], description: "Filter for specific compliance issues" },
          course_code: { type: Type.STRING, description: "Filter for a specific training course" }
        }
      }
    }
  ];

  const openRouterTools: OpenRouterToolSchema[] = maintenanceTools.map(t => ({
    name: t.name!,
    description: t.description ?? '',
    parameters: toOpenAISchema(t.parameters ?? { type: 'OBJECT', properties: {} }),
  }));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsThinking(true);

    if (!isGeminiConfigured()) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'SYSTEM OFFLINE: Gemini API key is not configured. Set `GEMINI_API_KEY` in `.env` (dev) or the `GEMINI_API_KEY` repository secret (prod build) and redeploy.'
      }]);
      setIsThinking(false);
      return;
    }

    // Shared tool executor — invoked by either Gemini's function-call
    // pipeline or OpenRouter's fallback tools pipeline. Takes the
    // canonical { name, args } pair and returns a JSON-serializable
    // result (or an empty array for unknown tools, so the model can
    // recover gracefully).
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

      // Real Firestore logic. Mirrors the query shape firestore.rules
      // permits — scoped to the caller's shop/AMU and to non-demo data.
      const collectionName =
        name === 'query_maintenance_logs' ? 'logs' :
        name === 'query_difm_inventory' ? 'difm' :
        name === 'query_training_compliance' ? 'training' : null;
      if (!collectionName) return [];

      let q = query(collection(db, collectionName), where('isDemo', '==', false), limit(20));
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
      if (a.tail_number) q = query(q, where('tail_number', '==', a.tail_number));
      if (a.status && collectionName !== 'logs') q = query(q, where('status', '==', a.status));
      if (a.shift && collectionName === 'logs') q = query(q, where('shift', '==', a.shift));
      if (a.isRedBall && collectionName === 'logs') q = query(q, where('isRedBall', '==', true));
      if (a.course_code && collectionName === 'training') q = query(q, where('course_code', '==', a.course_code));

      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    // Backup-channel runner — OpenRouter with tools first, plain text if
    // the free-tier model bungles tool-calling. Returns true on success.
    const runBackupChannel = async (labelNote: string): Promise<boolean> => {
      if (!isOpenRouterConfigured()) return false;
      const backupSystemPrompt =
        'You are the 92nd AMXS Maintenance Assistant backup channel. ' +
        'The primary AI (Gemini) is at its daily quota. You have access ' +
        'to tools for querying maintenance logs, DIFM inventory, and ' +
        'training compliance — use them when the maintainer asks for ' +
        'concrete records. Answer conceptual/how-to questions from your ' +
        'own knowledge. Be concise, practical, and military-technical ' +
        'when relevant. Bold RED BALLS and EXPIRED training. Use ' +
        'markdown tables for record-style data.';
      try {
        const toolsText = await runOpenRouterWithTools({
          systemPrompt: backupSystemPrompt,
          userPrompt: userMsg,
          tools: openRouterTools,
          executeToolCall,
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `*(Backup AI${labelNote ? ` — ${labelNote}` : ''})*\n\n${toolsText}`,
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
          content: `*(Backup AI — record lookups unavailable)*\n\n${plainText}`,
        }]);
        reportSuccess('assistant', 'openrouter');
        return true;
      } catch (textErr) {
        console.error('OpenRouter plain-text fallback failed:', textErr);
        return false;
      }
    };

    reportStart('assistant');

    // If Gemini is in cooldown from a recent quota hit, skip it and go
    // straight to OpenRouter — no point burning 7s of retry backoff.
    if (isGeminiOnCooldown() && isOpenRouterConfigured()) {
      const ok = await runBackupChannel('primary quota cooling down');
      if (ok) {
        setIsThinking(false);
        return;
      }
      // Backup also failed — fall through to Gemini attempt as a last resort.
    }

    try {
      const ai = getAI();
      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-1.5-flash-latest",
        contents: userMsg,
        config: {
          systemInstruction: `You are the 92nd AMXS Maintenance Assistant — a versatile helper for 92nd Air Refueling Squadron maintainers and leadership.

          SCOPE:
          - Answer any question related to aircraft maintenance, squadron operations, training programs, parts/supply workflows, procedures, concepts, or how-to guidance.
          - When the user asks for concrete records (logs for a tail, DIFM status, training gaps), call the appropriate tool to pull live data.
          - When the user asks a general, conceptual, or explanatory question, answer directly from your own knowledge. Do NOT refuse just because no tool applies.
          - If the user's intent is ambiguous, make a best-effort answer and offer to run a specific query if they want data.

          TOOLS AVAILABLE:
          - query_maintenance_logs, query_difm_inventory, query_training_compliance — use these only when the user clearly wants specific records from the database.

          TONE:
          - Clear, practical, and helpful. Military / technical context welcome but not required in every reply.
          - Keep answers concise. Use bullets or tables only when they genuinely aid scanning.

          FORMATTING:
          - Markdown tables for record-style data (logs, DIFM rows, training).
          - Bold RED BALLS and EXPIRED training when they appear.`,
          tools: [{ functionDeclarations: maintenanceTools }],
          temperature: 0,
        }
      }));

      if (response.functionCalls) {
        const toolOutputs: { callId: string; output: unknown }[] = [];
        for (const call of response.functionCalls) {
          const data = await executeToolCall(call.name!, (call.args ?? {}) as Record<string, unknown>);
          toolOutputs.push({ callId: call.id!, output: data });
        }

        const modelParts = response.candidates?.[0]?.content?.parts;
        if (!modelParts) {
          throw new Error('Gemini returned no candidate parts for the tool round-trip.');
        }

        // Send tool outputs back to model to get final response
        const finalResponse = await withRetry(() => ai.models.generateContent({
          model: "gemini-1.5-flash-latest",
          contents: [
            { role: 'user', parts: [{ text: userMsg }] },
            { role: 'model', parts: modelParts },
            {
              role: 'user',
              parts: toolOutputs.map(o => ({
                functionResponse: {
                  name: response.functionCalls![0].name,
                  response: { result: o.output },
                }
              }))
            }
          ],
          config: {
            systemInstruction: `Analyze the provided data result and summarize it for the maintainer.`,
            temperature: 0,
          }
        }));

        if (finalResponse.text) {
          setMessages(prev => [...prev, { role: 'assistant', content: finalResponse.text! }]);
        }
      } else if (response.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
      }
      reportSuccess('assistant');
    } catch (err) {
      console.error("AI Assistant Error:", err);
      const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
      markGeminiExhausted(err);

      if (shouldFallback(err)) {
        // If we are about to fallback, let the user know in the chat so they aren't confused
        // by the change in behavior or slight delay.
        if (isOpenRouterConfigured()) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '_Primary AI (Gemini) is at its daily quota. Engaging backup channel (OpenRouter)..._' 
          }]);
          
          const ok = await runBackupChannel('primary unavailable');
          if (ok) {
            setIsThinking(false);
            return;
          }
        }
      }

      reportError('assistant', classified);
      const friendly =
        classified.kind === 'quota' || classified.kind === 'rate_limit'
          ? `Maintenance Terminal: Primary AI (Gemini) is at its daily free-tier limit. ${isOpenRouterConfigured() ? 'The backup channel also failed.' : 'No backup channel (OpenRouter) is configured.'} Please check back after the quota resets or contact the administrator.`
          : `Assistant unavailable: ${classified.message}`;
      setMessages(prev => [...prev, { role: 'assistant', content: friendly }]);
    } finally {
      setIsThinking(false);
    }
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
