import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIRetryError, classifyError, withRetry } from './aiRetry';

describe('classifyError', () => {
  it('identifies 429 as rate_limit (retryable)', () => {
    const err = Object.assign(new Error('rate limit hit'), { status: 429 });
    const c = classifyError(err);
    expect(c.kind).toBe('rate_limit');
    expect(c.retryable).toBe(true);
  });

  it('identifies 503 as network (retryable)', () => {
    const err = Object.assign(new Error('service unavailable'), { status: 503 });
    const c = classifyError(err);
    expect(c.kind).toBe('network');
    expect(c.retryable).toBe(true);
  });

  it('identifies 401 as auth (non-retryable)', () => {
    const err = Object.assign(new Error('unauthorized'), { status: 401 });
    const c = classifyError(err);
    expect(c.kind).toBe('auth');
    expect(c.retryable).toBe(false);
  });

  it('identifies 403 as auth (non-retryable)', () => {
    const err = Object.assign(new Error('forbidden'), { status: 403 });
    const c = classifyError(err);
    expect(c.kind).toBe('auth');
    expect(c.retryable).toBe(false);
  });

  it('identifies zod-style parse errors as parse (non-retryable)', () => {
    const c = classifyError(new Error('Zod validation failed at path[0]'));
    expect(c.kind).toBe('parse');
    expect(c.retryable).toBe(false);
  });

  it('identifies timeout strings as timeout (retryable)', () => {
    const c = classifyError(new Error('operation timed out'));
    expect(c.kind).toBe('timeout');
    expect(c.retryable).toBe(true);
  });

  it('identifies abort as timeout (retryable)', () => {
    const c = classifyError(new DOMException('Aborted', 'AbortError'));
    expect(c.kind).toBe('timeout');
    expect(c.retryable).toBe(true);
  });

  it('identifies network strings as network (retryable)', () => {
    const c = classifyError(new Error('fetch failed'));
    expect(c.kind).toBe('network');
    expect(c.retryable).toBe(true);
  });

  it('identifies quota errors as quota (retryable)', () => {
    const c = classifyError(new Error('RESOURCE_EXHAUSTED: quota exceeded'));
    expect(c.kind).toBe('quota');
    expect(c.retryable).toBe(true);
  });

  it('identifies 400 as unknown non-retryable', () => {
    const err = Object.assign(new Error('bad request'), { status: 400 });
    const c = classifyError(err);
    expect(c.kind).toBe('unknown');
    expect(c.retryable).toBe(false);
  });

  it('unwraps AIRetryError to its classified payload', () => {
    const original = new AIRetryError({ kind: 'rate_limit', message: 'm', retryable: true });
    expect(classifyError(original).kind).toBe('rate_limit');
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the resolved value on first attempt without delay', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const p = withRetry(fn);
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors with exponential backoff and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 503 }))
      .mockResolvedValue('ok');

    const p = withRetry(fn, { baseDelayMs: 10 });
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws AIRetryError after exhausting retries on retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 503 }));

    const p = withRetry(fn, { retries: 2, baseDelayMs: 10 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    const result = await p;
    expect(result).toBeInstanceOf(AIRetryError);
    expect((result as AIRetryError).classified.kind).toBe('network');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable auth error', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 401 }));
    await expect(withRetry(fn, { baseDelayMs: 10 })).rejects.toMatchObject({
      name: 'AIRetryError',
      classified: expect.objectContaining({ kind: 'auth', retryable: false }),
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on zod parse error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Zod invalid schema'));
    await expect(withRetry(fn, { baseDelayMs: 10 })).rejects.toMatchObject({
      name: 'AIRetryError',
      classified: expect.objectContaining({ kind: 'parse', retryable: false }),
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts via timeout when inner fn never resolves', async () => {
    const fn = vi.fn((signal: AbortSignal) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    );
    const p = withRetry(fn, { retries: 0, timeoutMs: 100 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(100);
    const result = await p;
    expect(result).toBeInstanceOf(AIRetryError);
    expect((result as AIRetryError).classified.kind).toBe('timeout');
  });

  it('short-circuits retry loop when external signal aborts', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 503 }));

    const p = withRetry(fn, { baseDelayMs: 1000, signal: controller.signal }).catch((e) => e);
    // First attempt fails immediately; we're now in the 1000ms backoff sleep.
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    const result = await p;
    expect(result).toBeInstanceOf(AIRetryError);
    expect((result as AIRetryError).classified.kind).toBe('timeout');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
