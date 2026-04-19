import { z } from 'zod';
import { GenerateContentResponse } from '@google/genai';
import { getAI, isGeminiConfigured } from './gemini';
import { safeParse } from './aiSchemas';
import { withRetry, AIRetryError, classifyError } from './aiRetry';

// Provider-agnostic JSON generation with automatic Gemini → OpenRouter
// fallback. Gemini is the primary; OpenRouter is engaged only when
// Gemini's free tier exhausts its daily quota or trips a 429 rate limit.
// Other failure kinds (auth, parse, network) rethrow without fallback —
// they indicate config / data problems that the secondary provider can't
// magically fix.

export type AIProvider = 'gemini' | 'openrouter';

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
}

export interface GenerateJSONResult<T> {
  data: T | null;
  source: AIProvider;
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function shouldFallback(err: unknown): boolean {
  const classified = err instanceof AIRetryError ? err.classified : classifyError(err);
  return classified.kind === 'quota' || classified.kind === 'rate_limit';
}

async function callGemini<T>(opts: GenerateJSONOptions<T>): Promise<T | null> {
  const response: GenerateContentResponse = await withRetry(
    (signal) => {
      // Gemini SDK ignores AbortSignal at the request level today; we still
      // honor cancellation via withRetry's outer abort handling.
      void signal;
      return getAI().models.generateContent({
        model: opts.geminiModel ?? DEFAULT_GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: opts.temperature ?? 0.1,
        },
      });
    },
    { signal: opts.signal },
  );
  return safeParse(opts.schema, response.text, opts.context);
}

interface OpenRouterChoice {
  message?: { content?: string };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: { message?: string; code?: number };
}

async function callOpenRouter<T>(opts: GenerateJSONOptions<T>): Promise<T | null> {
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
        },
        body: JSON.stringify({
          model: opts.openRouterModel ?? DEFAULT_OPENROUTER_MODEL,
          temperature: opts.temperature ?? 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Respond with a single JSON value matching the requested shape. Do not wrap it in markdown fences or commentary.',
            },
            { role: 'user', content: opts.prompt },
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
    { signal: opts.signal },
  );
}

export async function generateJSONWithFallback<T>(
  opts: GenerateJSONOptions<T>,
): Promise<GenerateJSONResult<T>> {
  if (!isGeminiConfigured() && !isOpenRouterConfigured()) {
    throw new Error('No AI provider configured (set GEMINI_API_KEY or OPENROUTER_API_KEY).');
  }

  if (isGeminiConfigured()) {
    try {
      const data = await callGemini(opts);
      return { data, source: 'gemini' };
    } catch (err) {
      if (!shouldFallback(err) || !isOpenRouterConfigured()) throw err;
      console.warn(`[AI] ${opts.context}: Gemini quota/rate-limit — falling back to OpenRouter`);
    }
  }

  const data = await callOpenRouter(opts);
  return { data, source: 'openrouter' };
}
