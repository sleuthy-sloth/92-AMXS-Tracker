import { GoogleGenAI } from "@google/genai";

// SECURITY NOTE: process.env.GEMINI_API_KEY is inlined by Vite at build
// time (see vite.config.ts `define`), which means the key is visible in
// the compiled JS shipped to browsers. Treat this key as public: rotate
// it on any personnel change, restrict it by HTTP referrer in the Google
// Cloud console, and migrate Gemini calls to a server-side proxy
// (Firebase Functions / Cloud Run) before handling anything sensitive.

let _ai: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Add it to your .env file and restart the dev server.");
    }
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}
