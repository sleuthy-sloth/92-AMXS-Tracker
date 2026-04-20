import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '../contexts/AuthContext';
import { buildTourSteps, type TourStep } from '../lib/tour';

const SEEN_KEY = 'amxs-tour-seen';
const ANCHOR_TIMEOUT_MS = 1500;
const ANCHOR_POLL_INTERVAL_MS = 80;
const MOBILE_BREAKPOINT_PX = 768;

/**
 * Wait for an `[data-tour="..."]` anchor to mount after a route transition.
 * Returns true if it appeared in time, false if we gave up — in which case
 * driver.js renders the popover unanchored (still useful, just no spotlight).
 */
function waitForAnchor(selector: string): Promise<boolean> {
  if (document.querySelector(selector)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (document.querySelector(selector)) {
        clearInterval(id);
        resolve(true);
      } else if (Date.now() - start > ANCHOR_TIMEOUT_MS) {
        clearInterval(id);
        resolve(false);
      }
    }, ANCHOR_POLL_INTERVAL_MS);
  });
}

export interface GuidedTourControls {
  restartTour: () => void;
}

/**
 * Auto-launches the demo tour on first sandbox entry (gated by localStorage)
 * and exposes `restartTour` for the sidebar replay button. Tour is sandbox-only.
 */
export function useGuidedTour(): GuidedTourControls {
  const { profile, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const driverRef = useRef<Driver | null>(null);
  const startedRef = useRef(false);

  const runTour = useCallback(async () => {
    if (!profile) return;
    driverRef.current?.destroy();
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT_PX;
    const steps: TourStep[] = buildTourSteps(profile.role, { isMobile });

    let i = 0;
    const advance = async (): Promise<void> => {
      if (i >= steps.length) {
        d.destroy();
        return;
      }
      const step = steps[i++];
      if (step.route && window.location.hash !== `#${step.route}`) {
        navigate(step.route);
      }
      if (step.element) {
        await waitForAnchor(step.element as string);
      }
      d.highlight({
        element: step.element,
        popover: {
          ...step.popover,
          showButtons: ['next', 'close'],
          nextBtnText: i >= steps.length ? 'Finish' : 'Next →',
          onNextClick: () => {
            void advance();
          },
          onCloseClick: () => {
            d.destroy();
          },
        },
      });
    };

    const d = driver({
      animate: true,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      onDestroyed: () => {
        localStorage.setItem(SEEN_KEY, '1');
        driverRef.current = null;
      },
    });
    driverRef.current = d;
    await advance();
  }, [profile, navigate]);

  useEffect(() => {
    if (!isDemoMode || !profile || startedRef.current) return;
    if (localStorage.getItem(SEEN_KEY) === '1') return;
    startedRef.current = true;
    // Defer one frame so the dashboard mounts before we anchor onto it.
    const id = window.setTimeout(() => {
      void runTour();
    }, 250);
    return () => window.clearTimeout(id);
  }, [isDemoMode, profile, runTour]);

  // Reset the per-mount guard whenever the user leaves demo mode so a future
  // toggle back into sandbox doesn't get ignored.
  useEffect(() => {
    if (!isDemoMode) startedRef.current = false;
  }, [isDemoMode]);

  const restartTour = useCallback(() => {
    localStorage.removeItem(SEEN_KEY);
    void runTour();
  }, [runTour]);

  return { restartTour };
}
