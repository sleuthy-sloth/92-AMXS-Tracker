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

// Mock Firebase modules
vi.mock('../firebase', () => ({
  functions: {},
  db: {},
  auth: {},
}));

// Create a mock for httpsCallable
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockHttpsCallable,
}));

const Schema = z.array(z.object({ id: z.number() }));

const setKeys = (genaiMil?: string, openrouter?: string) => {
  if (genaiMil === undefined) delete process.env.GENAI_MIL_API_KEY;
  else process.env.GENAI_MIL_API_KEY = genaiMil;
  if (openrouter === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = openrouter;
};

const okProxyResponse = (data: unknown) => ({
  data: {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: { choices: [{ message: { content: JSON.stringify(data) } }] },
  },
});

// Throw AIRetryError to short-circuit withRetry's backoff loop in tests
const quotaError = () =>
  new AIRetryError({ kind: 'quota', message: 'quota exceeded', retryable: false });
const unavailableError = () =>
  new AIRetryError({ kind: 'network', message: '503 UNAVAILABLE', retryable: false, status: 503 });

describe('aiProvider.generateJSONWithFallback', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setKeys('test-genaimil', 'test-openrouter');
    const { __resetGeminiCooldownForTests } = await import('./aiProvider');
    __resetGeminiCooldownForTests();
  });

  afterEach(() => {
    setKeys();
  });

  it('returns genai-mil result on success without calling OpenRouter', async () => {
    mockHttpsCallable.mockResolvedValueOnce(okProxyResponse([{ id: 1 }]));

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('genai-mil');
    expect(result.data).toEqual([{ id: 1 }]);
    expect(mockHttpsCallable).toHaveBeenCalledOnce();
    expect(mockHttpsCallable.mock.calls[0][0]).toEqual({
      provider: 'genai-mil',
      body: expect.objectContaining({ model: expect.any(String) }),
    });
  });

  it('falls back to OpenRouter on GenAI.mil quota exhaustion', async () => {
    mockHttpsCallable
      .mockRejectedValueOnce(quotaError())
      .mockResolvedValueOnce(okProxyResponse([{ id: 9 }]));

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 9 }]);
    expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
  });

  it('falls back to OpenRouter on GenAI.mil 503 / UNAVAILABLE', async () => {
    mockHttpsCallable
      .mockRejectedValueOnce(unavailableError())
      .mockResolvedValueOnce(okProxyResponse([{ id: 7 }]));

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 7 }]);
    expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
  });

  it('does NOT fall back on auth errors — rethrows', async () => {
    mockHttpsCallable.mockRejectedValueOnce(
      new AIRetryError({ kind: 'auth', message: 'unauthorized', retryable: false })
    );

    const { generateJSONWithFallback } = await import('./aiProvider');
    await expect(
      generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' })
    ).rejects.toBeInstanceOf(AIRetryError);
  });

  it('falls back to OpenRouter when GenAI.mil key is locked (401 with unlock_url)', async () => {
    const lockError = new AIRetryError({
      kind: 'rate_limit',
      message: 'GenAI.mil key locked',
      retryable: false,
    });
    mockHttpsCallable
      .mockRejectedValueOnce(lockError)
      .mockResolvedValueOnce(okProxyResponse([{ id: 5 }]));

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 5 }]);
    expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
  });

  it('rethrows the GenAI.mil quota error when OpenRouter is unconfigured', async () => {
    setKeys('test-genaimil', undefined);
    mockHttpsCallable.mockRejectedValue(quotaError());

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
    mockHttpsCallable
      .mockRejectedValueOnce(quotaError())
      .mockResolvedValueOnce(okProxyResponse([{ id: 1 }]))
      .mockResolvedValueOnce(okProxyResponse([{ id: 2 }]));

    const { generateJSONWithFallback, isGeminiOnCooldown } = await import('./aiProvider');

    await generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' });
    expect(isGeminiOnCooldown()).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledTimes(2); // 1 genai-mil (fail) + 1 openrouter

    // Second call: cooldown should skip GenAI.mil entirely
    const secondResult = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });
    expect(secondResult.source).toBe('openrouter');
    expect(mockHttpsCallable).toHaveBeenCalledTimes(3); // +1 openrouter only
    expect(mockHttpsCallable.mock.calls[2][0]).toEqual({
      provider: 'openrouter',
      body: expect.objectContaining({ model: expect.any(String) }),
    });
  });

  it('returns null data when OpenRouter response fails schema validation', async () => {
    mockHttpsCallable
      .mockRejectedValueOnce(quotaError())
      .mockResolvedValueOnce(okProxyResponse([{ wrong: 'shape' }]));

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
