/**
 * 92 AMXS Tracker — Firebase Cloud Functions
 *
 * API keys are stored server-side in Firebase environment config or
 * Secret Manager. The client calls these functions instead of reaching
 * AI providers directly, keeping secrets out of the client bundle.
 *
 * Deployment:
 *   firebase functions:config:set genaimil.key="YOUR_KEY" openrouter.key="YOUR_KEY"
 *   firebase deploy --only functions
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

// ─── Secrets ──────────────────────────────────────────────────────────
// Set via: firebase functions:config:set genaimil.key="..." openrouter.key="..."
// Or use Secret Manager for production.

const GENAI_MIL_API_KEY = defineSecret('GENAI_MIL_API_KEY');
const OPENROUTER_API_KEY = defineSecret('OPENROUTER_API_KEY');

// ─── Endpoints ────────────────────────────────────────────────────────

const GENAI_MIL_ENDPOINT = 'https://api.genai.mil/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// ─── AI Proxy ─────────────────────────────────────────────────────────

interface ProxyAIRequest {
  provider: 'genai-mil' | 'openrouter';
  model?: string;
  messages: Array<{ role: string; content: string | Array<unknown> }>;
  temperature?: number;
  response_format?: { type: string };
  tools?: Array<Record<string, unknown>>;
  tool_choice?: string;
}

/**
 * Callable function that proxies AI requests to GenAI.mil or OpenRouter.
 * API keys are read from Firebase environment config/secret manager,
 * never exposed to the client.
 */
export const proxyAI = onCall(
  {
    secrets: [GENAI_MIL_API_KEY, OPENROUTER_API_KEY],
    cors: true,
  },
  async (request) => {
    // Must be authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const data = request.data as ProxyAIRequest;
    if (!data.provider || !data.messages) {
      throw new HttpsError('invalid-argument', 'Missing required fields: provider, messages');
    }

    // Verify @us.af.mil domain
    const uid = request.auth.uid;
    try {
      const userRecord = await getAuth().getUser(uid);
      const email = userRecord.email;
      if (!email || !email.toLowerCase().endsWith('@us.af.mil')) {
        throw new HttpsError('permission-denied', 'Only @us.af.mil accounts may use AI services.');
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Failed to verify authentication.');
    }

    const apiKey =
      data.provider === 'genai-mil'
        ? GENAI_MIL_API_KEY.value()
        : OPENROUTER_API_KEY.value();

    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        `${data.provider} API key is not configured on the server.`
      );
    }

    const endpoint =
      data.provider === 'genai-mil' ? GENAI_MIL_ENDPOINT : OPENROUTER_ENDPOINT;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    };

    if (data.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://sleuthy-sloth.github.io/92-AMXS-Tracker/';
      headers['X-Title'] = 'AMXS Maintenance System';
    }

    const body: Record<string, unknown> = {
      model: data.model ?? (data.provider === 'genai-mil' ? 'gemini-3.5-flash' : 'google/gemma-4-31b-it:free'),
      temperature: data.temperature ?? 0.1,
      messages: data.messages,
    };

    if (data.response_format) {
      body.response_format = data.response_format;
    }
    if (data.tools) {
      body.tools = data.tools;
    }
    if (data.tool_choice) {
      body.tool_choice = data.tool_choice;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        const errMsg = result?.error?.message ?? `HTTP ${response.status}`;
        const unlockUrl = result?.error?.unlock_url;
        const payload: Record<string, unknown> = {
          error: errMsg,
          status: response.status,
        };
        if (unlockUrl) {
          payload.unlock_url = unlockUrl;
        }
        throw new HttpsError('internal', errMsg, payload);
      }

      return { choices: result.choices };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new HttpsError('internal', `AI provider error: ${message}`);
    }
  }
);
