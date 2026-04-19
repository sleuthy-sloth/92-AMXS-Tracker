import { describe, it, expect, vi } from 'vitest';
import {
  safeParse,
  ScannedLogSchema,
  ScannedLogBookSchema,
  TrainingReportSchema,
  TrendAlertsSchema,
} from './aiSchemas';

describe('safeParse', () => {
  it('returns null for undefined input', () => {
    expect(safeParse(ScannedLogSchema, undefined, 'test')).toBeNull();
  });

  it('returns null for non-JSON input and logs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeParse(ScannedLogSchema, 'not json', 'test')).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[AI] test returned non-JSON'),
      expect.anything()
    );
    warn.mockRestore();
  });

  it('returns null for valid JSON but wrong shape', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      safeParse(TrendAlertsSchema, JSON.stringify([{ type: 'bogus', title: 't', description: 'd' }]), 'test')
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('fills defaults on ScannedLogSchema when fields missing', () => {
    const result = safeParse(ScannedLogSchema, JSON.stringify({}), 'test');
    expect(result).toEqual({ tail_number: '', discrepancy: '', repair: '' });
  });

  it('parses a valid ScannedLogBook array', () => {
    const payload = JSON.stringify([
      { tail_number: 'AF-92-001', discrepancy: 'LEAK', repair: 'SEALED' },
    ]);
    const result = safeParse(ScannedLogBookSchema, payload, 'test');
    expect(result).toHaveLength(1);
    expect(result?.[0].tail_number).toBe('AF-92-001');
  });

  it('parses TrainingReportSchema with optional fields', () => {
    const payload = JSON.stringify([
      { man_number: '1234', course_name: 'ADLS', due_date: '2026-06-01' },
    ]);
    const result = safeParse(TrainingReportSchema, payload, 'test');
    expect(result).toHaveLength(1);
    expect(result?.[0].course_name).toBe('ADLS');
  });

  it('parses TrendAlertsSchema with enum constraint', () => {
    const payload = JSON.stringify([
      { type: 'critical', title: 'X', description: 'Y' },
      { type: 'warning', title: 'A', description: 'B' },
    ]);
    const result = safeParse(TrendAlertsSchema, payload, 'test');
    expect(result).toHaveLength(2);
    expect(result?.[0].type).toBe('critical');
  });
});
