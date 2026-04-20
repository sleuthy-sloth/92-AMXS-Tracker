import type { DriveStep } from 'driver.js';
import type { UserRole } from '../types';

// Each step pairs a CSS selector to a popover. The selectors all use
// `data-tour` attributes added directly to the relevant page chrome —
// className / id-based targeting is brittle when Tailwind classes change.

export type TourStep = DriveStep & {
  /** Hash route to navigate to before the step renders. */
  route?: string;
};

export interface BuildTourOptions {
  /** Drop sidebar-anchored steps and use popover-only nav guidance instead. */
  isMobile?: boolean;
}

const isLeadership = (role: UserRole) => role === 'leadership';
const isAdminRole = (role: UserRole) => role === 'ncoic' || role === 'leadership';

export function buildTourSteps(role: UserRole, opts: BuildTourOptions = {}): TourStep[] {
  const navStep: TourStep = opts.isMobile
    ? {
        route: '/',
        popover: {
          title: 'Navigation',
          description:
            'Tap the menu icon (☰) at the top-left any time to open the navigation drawer: Operations, Training, Personnel, Handoff, Support — plus an Admin section for NCOIC / Leadership.',
        },
      }
    : {
        route: '/',
        element: '[data-tour="sidebar-nav"]',
        popover: {
          title: 'Navigation',
          description:
            'The sidebar groups the platform into Operations, Training, Personnel, Handoff, Support — plus an Admin drawer (NCOIC / Leadership only) for Diagnostics, Workload, and Onboarding.',
        },
      };

  const steps: TourStep[] = [
    {
      popover: {
        title: 'Welcome to the 92 AMXS Sandbox',
        description:
          "You're in demo mode. Nothing you change here touches live Firestore data — it's all in-memory mock records you can poke at safely. Let's walk the major surfaces.",
      },
    },
    navStep,
    {
      route: '/',
      element: '[data-tour="dashboard-matrix"]',
      popover: {
        title: 'Dashboard',
        description:
          'Your morning-brief view: readiness matrix at the top (open discrepancies, red balls, expiring training, personnel), followed by the AI Intelligence Feed that ranks 1–3 alerts from recent logs and training data.',
      },
    },
    {
      route: '/ops/maintenance',
      element: '[data-tour="logs-ocr-button"]',
      popover: {
        title: 'Maintenance Logs',
        description:
          'Log entries two ways: tap OCR Entry to snap an AF Form 781A and have Gemini extract JCN / tail / discrepancy, or Bulk Scan to import a full logbook page in one pass. Both keep rows editable before you commit.',
      },
    },
    {
      route: '/ops/difm',
      element: '[data-tour="difm-pipeline"]',
      popover: {
        title: 'DIFM Pipeline',
        description:
          'Track components from Ordered → En-Route → Received → Bench-Check → Installed. Status changes push notifications to the originating maintainer.',
      },
    },
    {
      route: '/ops/g081',
      element: '[data-tour="g081-grid"]',
      popover: {
        title: 'G081 Photo Gallery',
        description:
          'Every major repair pairs to a G081 screenshot. NCOICs verify; verified proofs older than 30 days are auto-flagged for re-verification.',
      },
    },
    {
      route: '/handoff',
      element: '[data-tour="page-root"]',
      popover: {
        title: 'Shift Handoff',
        description:
          'Outgoing shift drops line-item handoffs; incoming shift acknowledges. The 25-entry history keeps the audit trail tight without bloating the view.',
      },
    },
    {
      route: '/training',
      element: '[data-tour="page-root"]',
      popover: {
        title: 'Training Tracker',
        description:
          'Bulk-upload training manifests (PDF/Excel) or add records manually. Status auto-classifies as current / expiring / expired against a 30-day threshold.',
      },
    },
  ];

  if (isAdminRole(role)) {
    steps.push({
      route: '/diagnostics',
      element: '[data-tour="page-root"]',
      popover: {
        title: 'Predictive Diagnostics',
        description:
          'Pick a tail with repeat entries — Gemini surfaces recurring-component failure patterns with high/medium/low risk and ties each finding back to the specific log IDs you can open and verify.',
      },
    });
  }

  if (isLeadership(role)) {
    steps.push({
      route: '/workload',
      element: '[data-tour="page-root"]',
      popover: {
        title: 'Workload Distribution',
        description:
          '30-day technician dashboard: logs per tech, red-ball counts, 7-day trend, and balance classification (high/normal/low vs. team mean).',
      },
    });
  }

  steps.push({
    route: '/support',
    element: '[data-tour="ai-health-panel"]',
    popover: {
      title: 'AI System Status',
      description:
        'Live telemetry for every AI scan: status, last-run, error detail, and which provider answered (Gemini or OpenRouter). NCOIC / Leadership see full diagnostics.',
    },
  });

  steps.push({
    popover: {
      title: 'You\u2019re set',
      description:
        'Toggle out of Sandbox in the sidebar to return to live data, or click "Restart Tour" any time to replay this walkthrough.',
    },
  });

  return steps;
}
