import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

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
