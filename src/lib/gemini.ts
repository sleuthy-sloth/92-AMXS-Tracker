// SECURITY: API keys are no longer stored client-side. All AI calls are
// proxied through Cloud Functions (functions/src/proxyAI.ts). The proxy
// holds the keys as Firebase Secrets and validates authentication.
//
// In dev mode, set DEV_DIRECT_AI=true in .env.local to bypass the proxy
// and call AI providers directly (requires GENAI_MIL_API_KEY and
// OPENROUTER_API_KEY in .env.local).

export function isGenAIMilConfigured(): boolean {
  if (process.env.DEV_DIRECT_AI === 'true') {
    return Boolean(process.env.GENAI_MIL_API_KEY);
  }
  // In production, the proxy always has the key (managed server-side)
  return true;
}

export function isOpenRouterConfigured(): boolean {
  if (process.env.DEV_DIRECT_AI === 'true') {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }
  return true;
}

// Legacy: only used in DEV_DIRECT_AI mode
export function getGenAIMilApiKey(): string {
  const key = process.env.GENAI_MIL_API_KEY;
  if (!key) {
    throw new Error(
      'GENAI_MIL_API_KEY is not configured. Add it to .env.local and set DEV_DIRECT_AI=true, or use the Cloud Function proxy.'
    );
  }
  return key;
}
