import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AIRetryError } from './aiRetry';

// aiProvider now uses raw fetch for both providers; control behaviour via fetch spy.
vi.mock('./gemini', () => ({
  isGenAIMilConfigured: () => Boolean(process.env.GENAI_MIL_API_KEY),
  getGenAIMilApiKey: () => {
    const key = process.env.GENAI_MIL_API_KEY;
    if (!key) throw new Error('GENAI_MIL_API_KEY not configured.');
    return key;
  },
}));

const Schema = z.array(z.object({ id: z.number() }));

const setKeys = (genaiMil?: string, openrouter?: string) => {
  if (genaiMil === undefined) delete process.env.GENAI_MIL_API_KEY;
  else process.env.GENAI_MIL_API_KEY = genaiMil;
  if (openrouter === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = openrouter;
};

const okResponse = (data: unknown) =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }] }),
    { status: 200 }
  );

// Throw AIRetryError to short-circuit withRetry's backoff loop in tests
// (otherwise each fallback test would burn ~7s of real time on retries).
const quotaError = () =>
  new AIRetryError({ kind: 'quota', message: 'quota exceeded', retryable: false });
const unavailableError = () =>
  new AIRetryError({ kind: 'network', message: '503 UNAVAILABLE', retryable: false, status: 503 });

// URL-aware fetch mock: throws an AIRetryError for genai.mil calls (so withRetry
// bails immediately without sleeping) and returns the given response for all others.
const mockFetchFailPrimary = (
  primaryError: AIRetryError,
  fallbackData: unknown
) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if ((url as string).includes('genai.mil')) throw primaryError;
    return okResponse(fallbackData);
  });

describe('aiProvider.generateJSONWithFallback', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setKeys('test-genaimil', 'test-openrouter');
    const { __resetGeminiCooldownForTests } = await import('./aiProvider');
    __resetGeminiCooldownForTests();
  });

  afterEach(() => {
    setKeys();
  });

  it('returns genai-mil result on success without calling OpenRouter', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if ((url as string).includes('openrouter')) throw new Error('fetch should not call openrouter');
      return okResponse([{ id: 1 }]);
    });

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('genai-mil');
    expect(result.data).toEqual([{ id: 1 }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect((fetchSpy.mock.calls[0][0] as string)).toContain('genai.mil');
  });

  it('falls back to OpenRouter on GenAI.mil quota exhaustion', async () => {
    const fetchSpy = mockFetchFailPrimary(quotaError(), [{ id: 9 }]);

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 9 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to OpenRouter on GenAI.mil 503 / UNAVAILABLE', async () => {
    const fetchSpy = mockFetchFailPrimary(unavailableError(), [{ id: 7 }]);

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 7 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT fall back on auth errors — rethrows', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if ((url as string).includes('genai.mil')) {
        throw new AIRetryError({ kind: 'auth', message: 'unauthorized', retryable: false });
      }
      throw new Error('fetch should not call openrouter');
    });

    const { generateJSONWithFallback } = await import('./aiProvider');
    await expect(
      generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' })
    ).rejects.toBeInstanceOf(AIRetryError);
  });

  it('falls back to OpenRouter when GenAI.mil key is locked (401 with unlock_url)', async () => {
    // Key-lock throws as rate_limit (status 429) so shouldFallback returns true
    const lockError = new AIRetryError({ kind: 'rate_limit', message: 'GenAI.mil key locked', retryable: false });
    const fetchSpy = mockFetchFailPrimary(lockError, [{ id: 5 }]);

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 5 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rethrows the GenAI.mil quota error when OpenRouter is unconfigured', async () => {
    setKeys('test-genaimil', undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw quotaError();
    });

    const { generateJSONWithFallback } = await import('./aiProvider');
    await expect(
      generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' })
    ).rejects.toBeInstanceOf(AIRetryError);
  });

  it('throws when neither provider is configured', async () => {
    setKeys(undefined, undefined);
    const { generateJSONWithFallback } = await import('./aiProvider');
    await expect(
      generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' })
    ).rejects.toThrow(/No AI provider configured/);
  });

  it('skips GenAI.mil on the second call after a quota hit (cooldown)', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      callCount++;
      if ((url as string).includes('genai.mil')) throw quotaError();
      // OpenRouter always succeeds
      return okResponse([{ id: callCount }]);
    });

    const { generateJSONWithFallback, isGeminiOnCooldown } = await import('./aiProvider');
    await generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' });
    expect(isGeminiOnCooldown()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 genai-mil (fail) + 1 openrouter

    // Second call: cooldown should skip GenAI.mil entirely
    const secondResult = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });
    expect(secondResult.source).toBe('openrouter');
    expect(fetchSpy).toHaveBeenCalledTimes(3); // +1 openrouter only
    expect((fetchSpy.mock.calls[2][0] as string)).toContain('openrouter');
  });

  it('returns null data when OpenRouter response fails schema validation', async () => {
    mockFetchFailPrimary(quotaError(), [{ wrong: 'shape' }]);

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });
    expect(result.source).toBe('openrouter');
    expect(result.data).toBeNull();
  });
});
