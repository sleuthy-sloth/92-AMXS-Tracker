import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AIScanStatusProvider } from './AIScanStatusContext';
import { useScanStatus } from './AIScanStatusInstance';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AIScanStatusProvider>{children}</AIScanStatusProvider>
);

describe('AIScanStatusContext', () => {
  it('starts every scan kind in idle with runCount 0', () => {
    const { result } = renderHook(() => useScanStatus(), { wrapper });
    expect(result.current.statuses['assistant'].status).toBe('idle');
    expect(result.current.statuses['assistant'].runCount).toBe(0);
    expect(result.current.statuses['supply-risk'].status).toBe('idle');
    expect(result.current.statuses['g081-expiry'].status).toBe('idle');
    expect(result.current.statuses['training'].status).toBe('idle');
    expect(result.current.statuses['diagnostics'].status).toBe('idle');
    expect(result.current.statuses['intelligence-feed'].status).toBe('idle');
  });

  it('transitions idle → running → success on reportStart then reportSuccess', () => {
    const { result } = renderHook(() => useScanStatus(), { wrapper });

    act(() => result.current.reportStart('supply-risk'));
    expect(result.current.statuses['supply-risk'].status).toBe('running');

    act(() => result.current.reportSuccess('supply-risk'));
    expect(result.current.statuses['supply-risk'].status).toBe('success');
    expect(result.current.statuses['supply-risk'].runCount).toBe(1);
    expect(result.current.statuses['supply-risk'].lastRunAt).toBeTypeOf('number');
    expect(result.current.statuses['supply-risk'].lastError).toBeUndefined();
  });

  it('records lastError with kind and message on reportError', () => {
    const { result } = renderHook(() => useScanStatus(), { wrapper });

    act(() =>
      result.current.reportError('assistant', {
        kind: 'rate_limit',
        message: 'HTTP 429',
        retryable: true,
      })
    );
    const state = result.current.statuses['assistant'];
    expect(state.status).toBe('error');
    expect(state.lastError).toEqual({ kind: 'rate_limit', message: 'HTTP 429' });
    expect(state.runCount).toBe(1);
  });

  it('clears lastError on subsequent reportSuccess', () => {
    const { result } = renderHook(() => useScanStatus(), { wrapper });

    act(() =>
      result.current.reportError('diagnostics', {
        kind: 'auth',
        message: 'bad key',
        retryable: false,
      })
    );
    expect(result.current.statuses['diagnostics'].lastError).toBeDefined();

    act(() => result.current.reportSuccess('diagnostics'));
    expect(result.current.statuses['diagnostics'].status).toBe('success');
    expect(result.current.statuses['diagnostics'].lastError).toBeUndefined();
    expect(result.current.statuses['diagnostics'].runCount).toBe(2);
  });

  it('keeps scan kinds isolated from one another', () => {
    const { result } = renderHook(() => useScanStatus(), { wrapper });

    act(() => result.current.reportStart('training'));
    act(() =>
      result.current.reportError('intelligence-feed', {
        kind: 'network',
        message: 'fetch failed',
        retryable: true,
      })
    );

    expect(result.current.statuses['training'].status).toBe('running');
    expect(result.current.statuses['intelligence-feed'].status).toBe('error');
    expect(result.current.statuses['assistant'].status).toBe('idle');
  });

  it('records lastSource on reportSuccess when provided', () => {
    const { result } = renderHook(() => useScanStatus(), { wrapper });
    act(() => result.current.reportSuccess('intelligence-feed', 'openrouter'));
    expect(result.current.statuses['intelligence-feed'].lastSource).toBe('openrouter');
  });

  it('preserves prior lastSource when reportSuccess omits the source', () => {
    const { result } = renderHook(() => useScanStatus(), { wrapper });
    act(() => result.current.reportSuccess('supply-risk', 'gemini'));
    act(() => result.current.reportSuccess('supply-risk'));
    expect(result.current.statuses['supply-risk'].lastSource).toBe('gemini');
    expect(result.current.statuses['supply-risk'].runCount).toBe(2);
  });

  it('throws when useScanStatus is called outside a provider', () => {
    const Consumer: React.FC = () => {
      useScanStatus();
      return null;
    };
    expect(() => render(<Consumer />)).toThrow(/AIScanStatusProvider/);
  });
});
