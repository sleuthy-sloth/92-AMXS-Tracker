import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AIRetryError } from './aiRetry';

// Mock the gemini config functions
vi.mock('./gemini', () => ({
  isGenAIMilConfigured: () => Boolean(process.env.GENAI_MIL_API_KEY),
  isOpenRouterConfigured: () => Boolean(process.env.OPENROUTER_API_KEY),
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

/** Create a valid JSON response for the AI endpoint */
const okResponse = (data: unknown): Response =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(data) } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

/** Create an error fetch Response — used by test utilities */
const _errorResponse = (status: number, body: Record<string, unknown> = {}): Response =>
  new Response(JSON.stringify({ error: { message: body.message ?? 'Error', ...body } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Create a locked-key 401 response */
const lockResponse = (unlockUrl: string): Response =>
  new Response(
    JSON.stringify({
      error: { message: 'Key locked', unlock_url: unlockUrl },
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );

// Throw AIRetryError to short-circuit withRetry's backoff loop in tests
const quotaError = () =>
  new AIRetryError({ kind: 'quota', message: 'quota exceeded', retryable: false });
const unavailableError = () =>
  new AIRetryError({ kind: 'network', message: '503 UNAVAILABLE', retryable: false, status: 503 });

describe('aiProvider.generateJSONWithFallback', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setKeys('test-genaimil', 'test-openrouter');
    const { __resetGeminiCooldownForTests } = await import('./aiProvider');
    __resetGeminiCooldownForTests();

    // Default: mock fetch to succeed with GenAI.mil call
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse([{ id: 1 }]));
  });

  afterEach(() => {
    setKeys();
    vi.restoreAllMocks();
  });

  it('returns genai-mil result on success without calling OpenRouter', async () => {
    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('genai-mil');
    expect(result.data).toEqual([{ id: 1 }]);
    // Should only make one fetch call (GenAI.mil)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Verify it called the GenAI.mil endpoint
    const callUrl = fetchSpy.mock.calls[0][0];
    expect(callUrl).toContain('api.genai.mil');
  });

  it('falls back to OpenRouter on GenAI.mil quota exhaustion', async () => {
    // First call fails with quota, second succeeds
    fetchSpy.mockRejectedValueOnce(quotaError()).mockResolvedValueOnce(okResponse([{ id: 9 }]));

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 9 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // First call should be GenAI.mil, second should be OpenRouter
    expect(fetchSpy.mock.calls[0][0]).toContain('api.genai.mil');
    expect(fetchSpy.mock.calls[1][0]).toContain('openrouter.ai');
  });

  it('falls back to OpenRouter on GenAI.mil 503 / UNAVAILABLE', async () => {
    fetchSpy
      .mockRejectedValueOnce(unavailableError())
      .mockResolvedValueOnce(okResponse([{ id: 7 }]));

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
    fetchSpy.mockRejectedValueOnce(
      new AIRetryError({ kind: 'auth', message: 'unauthorized', retryable: false })
    );

    const { generateJSONWithFallback } = await import('./aiProvider');
    await expect(
      generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' })
    ).rejects.toBeInstanceOf(AIRetryError);
  });

  it('falls back to OpenRouter when GenAI.mil key is locked (401 with unlock_url)', async () => {
    const unlockUrl = 'https://unlock.genai.mil/key123';
    // First call: 401 with unlock_url (throws as rate_limit -> fallback eligible)
    fetchSpy
      .mockResolvedValueOnce(lockResponse(unlockUrl))
      .mockResolvedValueOnce(okResponse([{ id: 5 }]));

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
    fetchSpy.mockRejectedValue(quotaError());

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
    fetchSpy
      .mockRejectedValueOnce(quotaError())
      .mockResolvedValueOnce(okResponse([{ id: 1 }]))
      .mockResolvedValueOnce(okResponse([{ id: 2 }]));

    const { generateJSONWithFallback, isGeminiOnCooldown } = await import('./aiProvider');

    // First call: GenAI.mil fails, falls back to OpenRouter
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
    // Only one more OpenRouter call (not GenAI.mil)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[2][0]).toContain('openrouter.ai');
  });

  it('returns null data when OpenRouter response fails schema validation', async () => {
    fetchSpy
      .mockRejectedValueOnce(quotaError())
      .mockResolvedValueOnce(okResponse([{ wrong: 'shape' }]));

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
