import { describe, expect, it } from 'vitest';
import { buildTourSteps } from './tour';

describe('buildTourSteps', () => {
  it('returns the base step set for a technician (no admin steps)', () => {
    const steps = buildTourSteps('technician');
    const titles = steps.map((s) => s.popover?.title).filter(Boolean) as string[];
    expect(titles).toContain('Welcome to the 92 AMXS Sandbox');
    expect(titles).toContain('AI Intelligence Feed');
    expect(titles).not.toContain('Predictive Diagnostics');
    expect(titles).not.toContain('Workload Distribution');
  });

  it('includes Diagnostics for NCOIC but not Workload', () => {
    const titles = buildTourSteps('ncoic')
      .map((s) => s.popover?.title)
      .filter(Boolean) as string[];
    expect(titles).toContain('Predictive Diagnostics');
    expect(titles).not.toContain('Workload Distribution');
  });

  it('includes Diagnostics + Workload for leadership', () => {
    const titles = buildTourSteps('leadership')
      .map((s) => s.popover?.title)
      .filter(Boolean) as string[];
    expect(titles).toContain('Predictive Diagnostics');
    expect(titles).toContain('Workload Distribution');
  });

  it('every anchored step targets a data-tour selector', () => {
    const anchored = buildTourSteps('leadership').filter((s) => s.element);
    for (const s of anchored) {
      expect(typeof s.element).toBe('string');
      expect(s.element as string).toMatch(/^\[data-tour="/);
    }
  });
});
