import { z } from 'zod';
import { isGenAIMilConfigured, isOpenRouterConfigured, getGenAIMilApiKey } from './gemini';
export { isOpenRouterConfigured };
import { safeParse } from './aiSchemas';
import { withRetry, AIRetryError, classifyError } from './aiRetry';

// Provider-agnostic JSON generation with automatic GenAI.mil → OpenRouter
// fallback. API keys are injected at build time from .env.local (dev) or
// GitHub Secrets (CI/CD). The client calls AI providers directly.

export type AIProvider = 'genai-mil' | 'openrouter';

export interface GenerateJSONOptions<T> {
  prompt: string;
  schema: z.ZodSchema<T>;
  context: string;
  signal?: AbortSignal;
  /** Per-call model override. Defaults: gemini-3.5-flash / llama-3.2-3b:free. */
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
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_GENAI_MIL_MODEL = 'gemini-3.5-flash';
const DEFAULT_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';
const DEFAULT_OPENROUTER_FALLBACK_MODEL = 'nvidia/nemotron-nano-12b-2-vl:free';
// Tool calling: Gemma 4 31B supports native function calling and multimodal input.
const DEFAULT_OPENROUTER_TOOLS_MODEL = 'google/gemma-4-31b-it:free';

// OpenAI-compatible response types
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

interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenRouterToolSchema {
  name: string;
  description: string;
  /** JSON schema for the tool's parameters. */
  parameters: Record<string, unknown>;
}

// ─── Fallback logic ──────────────────────────────────────────────────

export function shouldFallback(err: unknown): boolean {
  const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
  return (
    classified.kind === 'quota' || classified.kind === 'rate_limit' || classified.kind === 'network'
  );
}

// ─── GenAI.mil cooldown circuit breaker ──────────────────────────────

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

// ─── Helper: direct fetch to an OpenAI-compatible endpoint ────────────

async function directFetch(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  options: { signal?: AbortSignal; extraHeaders?: Record<string, string> } = {}
): Promise<OpenAICompatResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options.extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const responseBody = (await res.json()) as OpenAICompatResponse;

  if (!res.ok) {
    const errMsg = responseBody?.error?.message ?? 'Unknown error';
    throw Object.assign(new Error(`${res.status}: ${errMsg}`), {
      status: res.status,
      statusText: res.statusText,
      body: responseBody,
    });
  }

  if (responseBody.error) {
    throw Object.assign(new Error(responseBody.error.message ?? 'API error'), {
      status: responseBody.error.code,
    });
  }

  return responseBody;
}

// ─── Provider implementations ────────────────────────────────────────

async function callGenAIMil<T>(opts: GenerateJSONOptions<T>): Promise<T | null> {
  const apiKey = getGenAIMilApiKey();

  return withRetry(
    async (signal) => {
      const userContent = opts.imageBase64
        ? [
            { type: 'text' as const, text: opts.prompt },
            {
              type: 'image_url' as const,
              image_url: { url: `data:image/jpeg;base64,${opts.imageBase64}` },
            },
          ]
        : opts.prompt;

      try {
        const json = await directFetch(
          GENAI_MIL_ENDPOINT,
          apiKey,
          {
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
          },
          { signal }
        );

        const raw = json.choices?.[0]?.message?.content;
        return safeParse(opts.schema, raw, opts.context);
      } catch (err) {
        // Special-case key-lock: 401 with unlock_url should fall back to OpenRouter.
        // Throw as non-retryable AIRetryError so withRetry propagates immediately.
        if (
          err &&
          typeof err === 'object' &&
          'status' in err &&
          (err as { status: number }).status === 401 &&
          'body' in err
        ) {
          const body = (err as { body: OpenAICompatResponse }).body;
          const unlockUrl = body?.error?.unlock_url;
          if (unlockUrl) {
            console.warn(`[AI] GenAI.mil key locked. Unlock at: ${unlockUrl}`);
            throw new AIRetryError({
              kind: 'rate_limit',
              message: `GenAI.mil key locked — visit ${unlockUrl} to unlock`,
              retryable: false,
              status: 429,
            });
          }
        }
        throw err;
      }
    },
    { signal: opts.signal }
  );
}

async function callOpenRouter<T>(opts: GenerateJSONOptions<T>): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  return withRetry(
    async (signal) => {
      const userContent = opts.imageBase64
        ? [
            { type: 'text' as const, text: opts.prompt },
            {
              type: 'image_url' as const,
              image_url: { url: `data:image/jpeg;base64,${opts.imageBase64}` },
            },
          ]
        : opts.prompt;

      const json = await directFetch(
        OPENROUTER_ENDPOINT,
        apiKey,
        {
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
        },
        {
          signal,
          extraHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'AMXS Maintenance System',
          },
        }
      );

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

// ─── Tool-calling implementations ────────────────────────────────────

async function directFetchWithError(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  options: { signal?: AbortSignal; extraHeaders?: Record<string, string> } = {}
): Promise<OpenAICompatResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options.extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const responseBody = (await res.json()) as OpenAICompatResponse;

  if (!res.ok) {
    const errMsg = responseBody?.error?.message ?? 'Unknown error';
    throw Object.assign(new Error(`${res.status}: ${errMsg}`), {
      status: res.status,
      statusText: res.statusText,
      body: responseBody,
    });
  }

  if (responseBody.error) {
    throw Object.assign(new Error(responseBody.error.message ?? 'API error'), {
      status: responseBody.error.code,
    });
  }

  return responseBody;
}

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
      try {
        const json = await directFetchWithError(
          GENAI_MIL_ENDPOINT,
          apiKey,
          {
            model,
            temperature,
            tools: toolsPayload,
            tool_choice: 'auto',
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: params.userPrompt },
            ],
          },
          { signal }
        );
        return json;
      } catch (err) {
        // Special-case key-lock: 401 with unlock_url should fall back to OpenRouter.
        // Throw as non-retryable AIRetryError so withRetry propagates immediately.
        if (
          err &&
          typeof err === 'object' &&
          'status' in err &&
          (err as { status: number }).status === 401 &&
          'body' in err
        ) {
          const body = (err as { body: OpenAICompatResponse }).body;
          const unlockUrl = body?.error?.unlock_url;
          if (unlockUrl) {
            console.warn(`[AI] GenAI.mil key locked. Unlock at: ${unlockUrl}`);
            throw new AIRetryError({
              kind: 'rate_limit',
              message: `GenAI.mil key locked — visit ${unlockUrl} to unlock`,
              retryable: false,
              status: 429,
            });
          }
        }
        throw err;
      }
    },
    { signal: params.signal }
  );

  const assistantMessage = firstResponse.choices?.[0]?.message;
  const toolCalls = assistantMessage?.tool_calls ?? [];

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
      const json = await directFetchWithError(
        GENAI_MIL_ENDPOINT,
        apiKey,
        {
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
        },
        { signal }
      );

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
      const json = await directFetchWithError(
        OPENROUTER_ENDPOINT,
        apiKey,
        {
          model: params.model ?? DEFAULT_OPENROUTER_MODEL,
          temperature: params.temperature ?? 0.2,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
        },
        {
          signal,
          extraHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'AMXS Maintenance System',
          },
        }
      );

      const raw = json.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('OpenRouter returned empty content');
      }
      return raw;
    },
    { signal: params.signal }
  );
}

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
      const json = await directFetchWithError(
        OPENROUTER_ENDPOINT,
        apiKey,
        {
          model,
          temperature,
          tools: toolsPayload,
          tool_choice: 'auto',
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
        },
        {
          signal,
          extraHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'AMXS Maintenance System',
          },
        }
      );

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
      const json = await directFetchWithError(
        OPENROUTER_ENDPOINT,
        apiKey,
        {
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
        },
        {
          signal,
          extraHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'AMXS Maintenance System',
          },
        }
      );

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
