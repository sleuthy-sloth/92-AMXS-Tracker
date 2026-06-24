// AI provider configuration check.
// In production, API keys are managed server-side via Cloud Functions proxy.
// For local development, you can set GENAI_MIL_API_KEY and OPENROUTER_API_KEY
// in .env.local — Vite prefixes with VITE_ for client-safe env vars.

export function isGenAIMilConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GENAI_MIL_API_KEY);
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(import.meta.env.VITE_OPENROUTER_API_KEY);
}

export function getGenAIMilApiKey(): string {
  const key = import.meta.env.VITE_GENAI_MIL_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      'GENAI_MIL_API_KEY is not configured. ' +
        'For local development, set VITE_GENAI_MIL_API_KEY in .env.local. ' +
        'For production, deploy the Cloud Functions proxy (functions/src/index.ts).'
    );
  }
  return key;
}

export function getOpenRouterApiKey(): string {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. ' +
        'For local development, set VITE_OPENROUTER_API_KEY in .env.local. ' +
        'For production, deploy the Cloud Functions proxy (functions/src/index.ts).'
    );
  }
  return key;
}
