import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AIRetryError } from './aiRetry';

// Module mocks must be hoisted; wire `getAI` to a vi.fn we can program per-test.
const mockGenerateContent = vi.fn();
vi.mock('./gemini', () => ({
  getAI: () => ({ models: { generateContent: mockGenerateContent } }),
  isGeminiConfigured: () => Boolean(process.env.GEMINI_API_KEY),
}));

const Schema = z.array(z.object({ id: z.number() }));

const setKeys = (gemini?: string, openrouter?: string) => {
  if (gemini === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = gemini;
  if (openrouter === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = openrouter;
};

// Throw AIRetryError to short-circuit withRetry's backoff loop in tests
// (otherwise each fallback test would burn ~7s of real time on retries).
const quotaError = () =>
  new AIRetryError({ kind: 'quota', message: 'quota exceeded', retryable: false });
const authError = () =>
  new AIRetryError({ kind: 'auth', message: 'unauthorized', retryable: false });
const unavailableError = () =>
  new AIRetryError({ kind: 'network', message: '503 UNAVAILABLE', retryable: false, status: 503 });

describe('aiProvider.generateJSONWithFallback', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    vi.restoreAllMocks();
    setKeys('test-gemini', 'test-openrouter');
  });

  afterEach(() => {
    setKeys();
  });

  it('returns gemini result on success without calling OpenRouter', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify([{ id: 1 }]) });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch should not be called');
    });

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('gemini');
    expect(result.data).toEqual([{ id: 1 }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to OpenRouter on Gemini quota exhaustion', async () => {
    mockGenerateContent.mockRejectedValue(quotaError());
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify([{ id: 9 }]) } }] }),
        { status: 200 }
      )
    );

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 9 }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('falls back to OpenRouter on Gemini 503 / UNAVAILABLE', async () => {
    mockGenerateContent.mockRejectedValue(unavailableError());
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify([{ id: 7 }]) } }] }),
        { status: 200 }
      )
    );

    const { generateJSONWithFallback } = await import('./aiProvider');
    const result = await generateJSONWithFallback({
      prompt: 'p',
      schema: Schema,
      context: 'test',
    });

    expect(result.source).toBe('openrouter');
    expect(result.data).toEqual([{ id: 7 }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('does NOT fall back on auth errors — rethrows', async () => {
    mockGenerateContent.mockRejectedValue(authError());
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { generateJSONWithFallback } = await import('./aiProvider');
    await expect(
      generateJSONWithFallback({ prompt: 'p', schema: Schema, context: 'test' })
    ).rejects.toBeInstanceOf(AIRetryError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rethrows the gemini quota error when OpenRouter is unconfigured', async () => {
    setKeys('test-gemini', undefined);
    mockGenerateContent.mockRejectedValue(quotaError());

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

  it('returns null data when OpenRouter response fails schema validation', async () => {
    mockGenerateContent.mockRejectedValue(quotaError());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify([{ wrong: 'shape' }]) } }] }),
        { status: 200 }
      )
    );

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
