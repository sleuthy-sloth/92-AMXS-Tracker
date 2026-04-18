import { describe, it, expect } from 'vitest';
import { tsToDate, tsToMillis, cn } from './utils';

describe('tsToDate / tsToMillis', () => {
  it('returns epoch-0 date when timestamp is null/undefined', () => {
    expect(tsToDate(null).getTime()).toBe(0);
    expect(tsToDate(undefined).getTime()).toBe(0);
    expect(tsToMillis(null)).toBe(0);
  });

  it('unwraps duck-typed Timestamp objects', () => {
    const fake = {
      toDate: () => new Date(1_700_000_000_000),
      toMillis: () => 1_700_000_000_000,
    };
    expect(tsToDate(fake as unknown as never).getTime()).toBe(1_700_000_000_000);
    expect(tsToMillis(fake as unknown as never)).toBe(1_700_000_000_000);
  });

  it('falls back to 0 for FieldValue-like sentinels with no toDate', () => {
    const fv = { _methodName: 'serverTimestamp' };
    expect(tsToDate(fv as unknown as never).getTime()).toBe(0);
    expect(tsToMillis(fv as unknown as never)).toBe(0);
  });
});

describe('cn', () => {
  it('merges class names and dedupes tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    const show = false as boolean;
    expect(cn('text-sm', show && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });
});
