import { z } from 'zod';
import { isGenAIMilConfigured, getGenAIMilApiKey } from './gemini';
import { safeParse } from './aiSchemas';
import { withRetry, AIRetryError, classifyError } from './aiRetry';

// Provider-agnostic JSON generation with automatic GenAI.mil → OpenRouter
// fallback. GenAI.mil is the primary; OpenRouter is engaged when GenAI.mil
// reports quota, rate-limit, key-lock (401 with unlock_url), or upstream
// unavailability (502/503/504 — classified as `network`). Auth errors
// (invalid key) and parse errors rethrow without fallback.

export type AIProvider = 'genai-mil' | 'openrouter';

export interface GenerateJSONOptions<T> {
  prompt: string;
  schema: z.ZodSchema<T>;
  context: string;
  signal?: AbortSignal;
  /** Per-call model override. Defaults: gemini-2.5-flash / llama-3.2-3b:free. */
  geminiModel?: string;
  openRouterModel?: string;
  /** Lower = more deterministic. Forwarded to both providers. */
  temperature?: number;
  /** Optional base64 encoded JPEG image data (without data:image/jpeg;base64, prefix) */
  imageBase64?: string;
}

export interface GenerateJSONResult<T> {
  data: T | null;
  source: AIProvider;
}

const GENAI_MIL_ENDPOINT = 'https://api.genai.mil/v1/chat/completions';
const DEFAULT_GENAI_MIL_MODEL = 'gemini-2.5-flash';

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash:free';
const DEFAULT_OPENROUTER_FALLBACK_MODEL = 'google/gemma-4-31b-it:free';
// Tool calling on free tier is hit-and-miss; google/gemini-2.5-flash:free is reliable.
const DEFAULT_OPENROUTER_TOOLS_MODEL = 'google/gemini-2.5-flash:free';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function shouldFallback(err: unknown): boolean {
  const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
  return (
    classified.kind === 'quota' || classified.kind === 'rate_limit' || classified.kind === 'network'
  );
}

// ─── GenAI.mil cooldown circuit breaker ───────────────────────────────
// Once GenAI.mil reports quota / rate-limit / key-lock, skip it until the
// retry window has passed to avoid burning retry backoff on every call.
const COOLDOWN_STORAGE_KEY = 'amxs-genaimil-cooldown-until';
const COOLDOWN_MIN_MS = 10_000;
const COOLDOWN_MAX_MS = 10 * 60_000;
const COOLDOWN_DEFAULT_MS = 60_000;

let genaiMilCooldownUntil = 0;

function parseRetryDelayMs(message: string): number {
  const inline = message.match(/retry in\s+([\d.]+)\s*s/i);
  if (inline) return Math.ceil(Number(inline[1]) * 1000);
  const retryField = message.match(/"retryDelay"\s*:\s*"(\d+)\s*s"/i);
  if (retryField) return Number(retryField[1]) * 1000;
  return 0;
}

export function markGeminiExhausted(err: unknown): void {
  const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
  if (classified.kind !== 'quota' && classified.kind !== 'rate_limit') return;
  const parsed = parseRetryDelayMs(classified.message);
  const cooldownMs = Math.min(
    Math.max(parsed || COOLDOWN_DEFAULT_MS, COOLDOWN_MIN_MS),
    COOLDOWN_MAX_MS
  );
  genaiMilCooldownUntil = Date.now() + cooldownMs;
  try {
    sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(genaiMilCooldownUntil));
  } catch {
    // sessionStorage unavailable — in-memory cooldown is still effective
  }
  console.warn(
    `[AI] GenAI.mil ${classified.kind} — skipping for ${(cooldownMs / 1000).toFixed(0)}s`
  );
}

export function isGeminiOnCooldown(): boolean {
  if (genaiMilCooldownUntil && Date.now() < genaiMilCooldownUntil) return true;
  try {
    const raw = sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return false;
    const stored = Number(raw);
    if (Number.isFinite(stored) && Date.now() < stored) {
      genaiMilCooldownUntil = stored;
      return true;
    }
    sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
  } catch {
    // ignore
  }
  return false;
}

export function geminiCooldownRemainingMs(): number {
  return Math.max(0, genaiMilCooldownUntil - Date.now());
}

/** Test-only: clear the cooldown so suites don't leak state across tests. */
export function __resetGeminiCooldownForTests(): void {
  genaiMilCooldownUntil = 0;
  try {
    sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

interface OpenAICompatChoice {
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: OpenRouterToolCall[];
  };
  finish_reason?: string;
}
interface OpenAICompatResponse {
  choices?: OpenAICompatChoice[];
  error?: { message?: string; code?: number; unlock_url?: string };
}

async function callGenAIMil<T>(opts: GenerateJSONOptions<T>): Promise<T | null> {
  const apiKey = getGenAIMilApiKey();

  return withRetry(
    async (signal) => {
      const userContent = opts.imageBase64
        ? [
            { type: 'text', text: opts.prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${opts.imageBase64}` } },
          ]
        : opts.prompt;

      const res = await fetch(GENAI_MIL_ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: opts.geminiModel ?? DEFAULT_GENAI_MIL_MODEL,
          temperature: opts.temperature ?? 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Respond with a single JSON value matching the requested shape. Do not wrap it in markdown fences or commentary.',
            },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (!res.ok) {
        // Special-case key-lock: 401 with unlock_url should fall back to OpenRouter
        if (res.status === 401) {
          const body = await res.json().catch(() => ({} as OpenAICompatResponse));
          const unlockUrl = (body as OpenAICompatResponse)?.error?.unlock_url;
          if (unlockUrl) {
            console.warn(`[AI] GenAI.mil key locked. Unlock at: ${unlockUrl}`);
            // Throw as 429 so classifyError treats it as rate_limit → fallback eligible
            throw Object.assign(
              new Error(`GenAI.mil key locked — visit ${unlockUrl} to unlock`),
              { status: 429 }
            );
          }
        }
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`GenAI.mil ${res.status}: ${body || res.statusText}`), {
          status: res.status,
        });
      }

      const json = (await res.json()) as OpenAICompatResponse;
      if (json.error) {
        throw Object.assign(new Error(json.error.message ?? 'GenAI.mil error'), {
          status: json.error.code,
        });
      }
      const raw = json.choices?.[0]?.message?.content;
      return safeParse(opts.schema, raw, opts.context);
    },
    { signal: opts.signal }
  );
}

interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
interface OpenRouterChoice {
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: OpenRouterToolCall[];
  };
  finish_reason?: string;
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: { message?: string; code?: number };
}

export interface OpenRouterToolSchema {
  name: string;
  description: string;
  /** JSON schema for the tool's parameters. */
  parameters: Record<string, unknown>;
}

async function callOpenRouter<T>(opts: GenerateJSONOptions<T>): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  return withRetry(
    async (signal) => {
      const userContent = opts.imageBase64
        ? [
            { type: 'text', text: opts.prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${opts.imageBase64}` } },
          ]
        : opts.prompt;

      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AMXS Maintenance System',
        },
        body: JSON.stringify({
          model: opts.openRouterModel ?? DEFAULT_OPENROUTER_MODEL,
          temperature: opts.temperature ?? 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Respond with a single JSON value matching the requested shape. Do not wrap it in markdown fences or commentary.',
            },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`OpenRouter ${res.status}: ${body || res.statusText}`), {
          status: res.status,
        });
      }

      const json = (await res.json()) as OpenRouterResponse;
      if (json.error) {
        throw Object.assign(new Error(json.error.message ?? 'OpenRouter error'), {
          status: json.error.code,
        });
      }
      const raw = json.choices?.[0]?.message?.content;
      return safeParse(opts.schema, raw, `${opts.context}/openrouter`);
    },
    { signal: opts.signal }
  );
}

export async function generateJSONWithFallback<T>(
  opts: GenerateJSONOptions<T>
): Promise<GenerateJSONResult<T>> {
  if (!isGenAIMilConfigured() && !isOpenRouterConfigured()) {
    throw new Error('No AI provider configured (set GENAI_MIL_API_KEY or OPENROUTER_API_KEY).');
  }

  if (isGenAIMilConfigured() && !isGeminiOnCooldown()) {
    try {
      const data = await callGenAIMil(opts);
      return { data, source: 'genai-mil' };
    } catch (primaryErr) {
      if (!shouldFallback(primaryErr)) {
        throw primaryErr;
      }
      markGeminiExhausted(primaryErr);
      if (!isOpenRouterConfigured()) {
        throw primaryErr;
      }
      const kind = primaryErr instanceof AIRetryError ? primaryErr.classified.kind : 'unknown';
      console.warn(`[AI] ${opts.context}: GenAI.mil (${kind}) — attempting OpenRouter fallback`);
    }
  }

  if (isOpenRouterConfigured()) {
    try {
      const data = await callOpenRouter({
        ...opts,
        openRouterModel: opts.openRouterModel ?? DEFAULT_OPENROUTER_MODEL,
      });
      return { data, source: 'openrouter' };
    } catch (err) {
      const kind = err instanceof AIRetryError ? err.classified.kind : 'unknown';
      console.warn(
        `[AI] ${opts.context}: OpenRouter primary (${kind}) — attempting OpenRouter Gemma fallback`
      );

      const data = await callOpenRouter({
        ...opts,
        openRouterModel: DEFAULT_OPENROUTER_FALLBACK_MODEL,
      });
      return { data, source: 'openrouter' };
    }
  }

  throw new Error('All configured AI providers failed or are on cooldown.');
}

/**
 * Tool-calling conversation against GenAI.mil (primary). Mirrors the
 * OpenRouter tool-calling path but uses the GenAI.mil endpoint and key.
 * Handles the full 2-turn round-trip: initial call → execute tool calls
 * via the caller-supplied executor → second call with tool results →
 * final text answer. On key-lock (401 with unlock_url), rethrows as a
 * rate_limit so the caller's fallback logic engages.
 */
export async function runGenAIMilWithTools(params: {
  systemPrompt: string;
  userPrompt: string;
  tools: OpenRouterToolSchema[];
  executeToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  signal?: AbortSignal;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = getGenAIMilApiKey();
  const model = params.model ?? DEFAULT_GENAI_MIL_MODEL;
  const temperature = params.temperature ?? 0;
  const toolsPayload = params.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const firstResponse = await withRetry(
    async (signal) => {
      const res = await fetch(GENAI_MIL_ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          tools: toolsPayload,
          tool_choice: 'auto',
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          const body = await res.json().catch(() => ({} as OpenAICompatResponse));
          const unlockUrl = (body as OpenAICompatResponse)?.error?.unlock_url;
          if (unlockUrl) {
            console.warn(`[AI] GenAI.mil key locked. Unlock at: ${unlockUrl}`);
            throw Object.assign(
              new Error(`GenAI.mil key locked — visit ${unlockUrl} to unlock`),
              { status: 429 }
            );
          }
        }
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`GenAI.mil ${res.status}: ${body || res.statusText}`), {
          status: res.status,
        });
      }
      const json = (await res.json()) as OpenAICompatResponse;
      if (json.error) {
        throw Object.assign(new Error(json.error.message ?? 'GenAI.mil error'), {
          status: json.error.code,
        });
      }
      return json;
    },
    { signal: params.signal }
  );

  const assistantMessage = firstResponse.choices?.[0]?.message;
  const toolCalls = (assistantMessage as { tool_calls?: OpenRouterToolCall[] })?.tool_calls ?? [];

  if (toolCalls.length === 0) {
    const text = assistantMessage?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('GenAI.mil returned neither tool calls nor text');
    }
    return text;
  }

  const toolResults: Array<{ tool_call_id: string; name: string; content: string }> = [];
  for (const call of toolCalls) {
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = call.function.arguments
        ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
        : {};
    } catch {
      throw new Error(`GenAI.mil returned malformed tool arguments for ${call.function.name}`);
    }
    const result = await params.executeToolCall(call.function.name, parsedArgs);
    toolResults.push({
      tool_call_id: call.id,
      name: call.function.name,
      content: JSON.stringify(result ?? null),
    });
  }

  const finalText = await withRetry(
    async (signal) => {
      const res = await fetch(GENAI_MIL_ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
            {
              role: 'assistant',
              content: assistantMessage?.content ?? '',
              tool_calls: toolCalls,
            },
            ...toolResults.map((r) => ({
              role: 'tool' as const,
              tool_call_id: r.tool_call_id,
              name: r.name,
              content: r.content,
            })),
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`GenAI.mil ${res.status}: ${body || res.statusText}`), {
          status: res.status,
        });
      }
      const json = (await res.json()) as OpenAICompatResponse;
      if (json.error) {
        throw Object.assign(new Error(json.error.message ?? 'GenAI.mil error'), {
          status: json.error.code,
        });
      }
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('GenAI.mil returned empty final content');
      }
      return content;
    },
    { signal: params.signal }
  );

  return finalText;
}

/**
 * Plain-text completion via OpenRouter — no Zod schema, no tools. Used by
 * the Maintenance Assistant's catch path when the primary provider's
 * function-calling is unavailable (quota / rate-limit / 5xx). Loses the
 * ability to fetch live records, but answers conceptual questions from the
 * model's own knowledge.
 */
export async function generateTextWithOpenRouter(params: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  return withRetry(
    async (signal) => {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AMXS Maintenance System',
        },
        body: JSON.stringify({
          model: params.model ?? DEFAULT_OPENROUTER_MODEL,
          temperature: params.temperature ?? 0.2,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`OpenRouter ${res.status}: ${body || res.statusText}`), {
          status: res.status,
        });
      }

      const json = (await res.json()) as OpenRouterResponse;
      if (json.error) {
        throw Object.assign(new Error(json.error.message ?? 'OpenRouter error'), {
          status: json.error.code,
        });
      }
      const raw = json.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('OpenRouter returned empty content');
      }
      return raw;
    },
    { signal: params.signal }
  );
}

/**
 * Run a tool-calling conversation against OpenRouter. Used when the primary
 * provider is unavailable (quota / rate-limit / 5xx) but we still want live
 * record lookups. Handles the full round-trip internally: initial call →
 * execute tool calls via the caller-supplied executor → second call with
 * tool results → final text answer.
 *
 * Throws on bad tool-call JSON, unknown tool names, or empty final
 * content — caller is expected to catch and fall through to a plain-text
 * completion so the user still gets an answer.
 */
export async function runOpenRouterWithTools(params: {
  systemPrompt: string;
  userPrompt: string;
  tools: OpenRouterToolSchema[];
  executeToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  signal?: AbortSignal;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const model = params.model ?? DEFAULT_OPENROUTER_TOOLS_MODEL;
  const temperature = params.temperature ?? 0;
  const toolsPayload = params.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const firstResponse = await withRetry(
    async (signal) => {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AMXS Maintenance System',
        },
        body: JSON.stringify({
          model,
          temperature,
          tools: toolsPayload,
          tool_choice: 'auto',
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`OpenRouter ${res.status}: ${body || res.statusText}`), {
          status: res.status,
        });
      }
      const json = (await res.json()) as OpenRouterResponse;
      if (json.error) {
        throw Object.assign(new Error(json.error.message ?? 'OpenRouter error'), {
          status: json.error.code,
        });
      }
      return json;
    },
    { signal: params.signal }
  );

  const assistantMessage = firstResponse.choices?.[0]?.message;
  const toolCalls = assistantMessage?.tool_calls ?? [];

  if (toolCalls.length === 0) {
    const text = assistantMessage?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('OpenRouter returned neither tool calls nor text');
    }
    return text;
  }

  // Execute each tool call. Any parse / unknown-name failure throws and
  // the caller falls back to plain-text completion.
  const toolResults: Array<{ tool_call_id: string; name: string; content: string }> = [];
  for (const call of toolCalls) {
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = call.function.arguments
        ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
        : {};
    } catch {
      throw new Error(`OpenRouter returned malformed tool arguments for ${call.function.name}`);
    }
    const result = await params.executeToolCall(call.function.name, parsedArgs);
    toolResults.push({
      tool_call_id: call.id,
      name: call.function.name,
      content: JSON.stringify(result ?? null),
    });
  }

  const finalText = await withRetry(
    async (signal) => {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
            {
              role: 'assistant',
              content: assistantMessage?.content ?? '',
              tool_calls: toolCalls,
            },
            ...toolResults.map((r) => ({
              role: 'tool' as const,
              tool_call_id: r.tool_call_id,
              name: r.name,
              content: r.content,
            })),
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`OpenRouter ${res.status}: ${body || res.statusText}`), {
          status: res.status,
        });
      }
      const json = (await res.json()) as OpenRouterResponse;
      if (json.error) {
        throw Object.assign(new Error(json.error.message ?? 'OpenRouter error'), {
          status: json.error.code,
        });
      }
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('OpenRouter returned empty final content');
      }
      return content;
    },
    { signal: params.signal }
  );

  return finalText;
}
