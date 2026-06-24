import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isGenAIMilConfigured } from './lib/gemini';
import { isOpenRouterConfigured } from './lib/aiProvider';

if (!isGenAIMilConfigured() && !isOpenRouterConfigured()) {
  console.warn(
    '[AMXS] No AI provider configured. ' +
      'For production, deploy the Cloud Functions proxy (functions/src/index.ts). ' +
      'For local development, set VITE_GENAI_MIL_API_KEY or VITE_OPENROUTER_API_KEY in .env.local.'
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
