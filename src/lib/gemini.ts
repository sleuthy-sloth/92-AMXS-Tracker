// SECURITY NOTE: process.env.GENAI_MIL_API_KEY is inlined by Vite at build
// time (see vite.config.ts `define`), which means the key is visible in
// the compiled JS shipped to browsers. Additionally, GenAI.mil keys lock
// every 8 hours — the app falls back to OpenRouter automatically, but
// someone with the key must visit the unlock URL to re-enable it.

export function isGenAIMilConfigured(): boolean {
  return Boolean(process.env.GENAI_MIL_API_KEY);
}

export function getGenAIMilApiKey(): string {
  const key = process.env.GENAI_MIL_API_KEY;
  if (!key) {
    throw new Error('GENAI_MIL_API_KEY is not configured. Add it to your .env file and restart the dev server.');
  }
  return key;
}
