import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// API keys stored as Firebase Secrets — set via:
//   firebase functions:secrets:set GENAI_MIL_API_KEY
//   firebase functions:secrets:set OPENROUTER_API_KEY
const GENAI_MIL_API_KEY = defineSecret('GENAI_MIL_API_KEY');
const OPENROUTER_API_KEY = defineSecret('OPENROUTER_API_KEY');

const GENAI_MIL_ENDPOINT = 'https://api.genai.mil/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// ─── Types ──────────────────────────────────────────────────────────

interface ProxyAIRequest {
  provider: 'genai-mil' | 'openrouter';
  body: Record<string, unknown>;
}

interface OpenAICompatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  error?: { message?: string; code?: number; unlock_url?: string };
  usage?: Record<string, unknown>;
}

// ─── Rate limiting (in-memory, per-instance) ────────────────────────
// Cloud Functions v2 instances are reused for ~15 min. This simple
// map tracks per-UID request counts within a rolling 1-hour window.
// For production-grade limiting, use Firestore or Redis.

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 120; // per hour per user

/** Cleanup stale entries to prevent memory leaks on long-lived instances */
function cleanupStaleEntries(): void {
  const now = Date.now();
  for (const [uid, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(uid);
    }
  }
}

function checkRateLimit(uid: string): void {
  // Periodically clean up stale entries (probabilistic to avoid per-request overhead)
  if (Math.random() < 0.1) cleanupStaleEntries();

  const now = Date.now();
  const entry = rateLimitMap.get(uid);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(uid, { count: 1, windowStart: now });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = entry.windowStart + RATE_LIMIT_WINDOW_MS - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    throw new HttpsError(
      'resource-exhausted',
      `Rate limit exceeded (${RATE_LIMIT_MAX_REQUESTS}/hour). Try again in ${retryAfterSec}s.`,
      { retryAfter: retryAfterSec }
    );
  }

  entry.count++;
}

// ─── Proxy function ─────────────────────────────────────────────────

export const proxyAI = onCall(
  {
    secrets: [GENAI_MIL_API_KEY, OPENROUTER_API_KEY],
    memory: '512MiB',
    timeoutSeconds: 120,
    cors: ['https://sleuthy-sloth.github.io', 'http://localhost:3000', 'http://localhost:5173'],
  },
  async (request) => {
    // 1. Authentication check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated to use AI proxy.');
    }

    // 2. Rate limiting
    checkRateLimit(request.auth.uid);

    // 3. Validate input
    const data = request.data as ProxyAIRequest;
    if (!data.provider || !data.body) {
      throw new HttpsError('invalid-argument', 'Missing required fields: provider, body');
    }

    if (data.provider !== 'genai-mil' && data.provider !== 'openrouter') {
      throw new HttpsError(
        'invalid-argument',
        `Invalid provider: ${data.provider}. Must be 'genai-mil' or 'openrouter'.`
      );
    }

    // 4. Select endpoint and API key
    let endpoint: string;
    let apiKey: string;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (data.provider === 'genai-mil') {
      endpoint = GENAI_MIL_ENDPOINT;
      apiKey = GENAI_MIL_API_KEY.value();
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      endpoint = OPENROUTER_ENDPOINT;
      apiKey = OPENROUTER_API_KEY.value();
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://sleuthy-sloth.github.io/92-AMXS-Tracker/';
      headers['X-Title'] = 'AMXS Maintenance System';
    }

    // 5. Forward the request
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data.body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpsError('unavailable', `Upstream fetch failed: ${message}`);
    }

    // 6. Parse response
    const responseBody = (await res.json()) as OpenAICompatResponse;

    // 7. Return structured result
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      body: responseBody,
    };
  }
);
