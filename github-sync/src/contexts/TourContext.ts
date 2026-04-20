import { createContext } from 'react';
import type { GuidedTourControls } from '../hooks/useGuidedTour';

// Sidebar reads `restartTour` from this context. The provider lives in App.tsx
// and gets its value from `useGuidedTour()`.
export const TourContext = createContext<GuidedTourControls | null>(null);
