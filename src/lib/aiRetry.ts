export type AIErrorKind =
  | 'rate_limit'
  | 'quota'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'parse'
  | 'unknown';

export interface ClassifiedError {
  kind: AIErrorKind;
  message: string;
  retryable: boolean;
  status?: number;
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class AIRetryError extends Error {
  classified: ClassifiedError;
  constructor(classified: ClassifiedError) {
    super(classified.message);
    this.name = 'AIRetryError';
    this.classified = classified;
  }
}

const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.code === 'number') return candidate.code;
  if (candidate.response && typeof candidate.response.status === 'number')
    return candidate.response.status;
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

export function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const status = extractStatus(err);

  if (err instanceof AIRetryError) return err.classified;

  if (lower.includes('zod') || lower.includes('parse') || lower.includes('invalid json')) {
    return { kind: 'parse', message, retryable: false, status };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api key') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return { kind: 'auth', message, retryable: false, status };
  }

  if (status === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
    return { kind: 'rate_limit', message, retryable: true, status };
  }

  if (lower.includes('quota') || lower.includes('resource_exhausted')) {
    return { kind: 'quota', message, retryable: true, status };
  }

  if (lower.includes('abort') || lower.includes('timeout') || lower.includes('timed out')) {
    return { kind: 'timeout', message, retryable: true, status };
  }

  if (
    (status && status >= 500) ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('econn')
  ) {
    return { kind: 'network', message, retryable: true, status };
  }

  if (status && status >= 400 && status < 500) {
    return { kind: 'unknown', message, retryable: false, status };
  }

  return { kind: 'unknown', message, retryable: false, status };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const baseDelay = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastClassified: ClassifiedError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      return await fn(controller.signal);
    } catch (err) {
      const classified = classifyError(err);
      lastClassified = classified;

      if (opts.signal?.aborted) {
        throw new AIRetryError({ kind: 'timeout', message: 'Cancelled', retryable: false });
      }

      if (!classified.retryable || attempt === retries) {
        throw new AIRetryError(classified);
      }

      const delay = baseDelay * Math.pow(2, attempt);
      try {
        await sleep(delay, opts.signal);
      } catch {
        throw new AIRetryError({ kind: 'timeout', message: 'Cancelled', retryable: false });
      }
    } finally {
      clearTimeout(timeoutId);
      opts.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  throw new AIRetryError(
    lastClassified ?? { kind: 'unknown', message: 'Retry loop exhausted', retryable: false }
  );
}
