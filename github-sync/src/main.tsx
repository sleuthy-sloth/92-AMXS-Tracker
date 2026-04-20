import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isGeminiConfigured } from './lib/gemini';
import { isOpenRouterConfigured } from './lib/aiProvider';

if (!isGeminiConfigured() && !isOpenRouterConfigured()) {
  console.warn('[AMXS] No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
