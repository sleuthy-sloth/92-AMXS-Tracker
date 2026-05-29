// API keys are injected at build time from .env.local (dev) or GitHub Secrets (CI/CD).
// The client calls AI providers directly — no Cloud Functions proxy needed.

export function isGenAIMilConfigured(): boolean {
  return Boolean(process.env.GENAI_MIL_API_KEY);
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getGenAIMilApiKey(): string {
  const key = process.env.GENAI_MIL_API_KEY;
  if (!key) {
    throw new Error(
      'GENAI_MIL_API_KEY is not configured. Add it to .env.local or set GENAI_MIL_API_KEY as a GitHub repository secret.'
    );
  }
  return key;
}
