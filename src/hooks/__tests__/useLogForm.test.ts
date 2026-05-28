import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogForm } from '../useLogForm';

describe('useLogForm', () => {
  it('initializes with empty form data', () => {
    const { result } = renderHook(() => useLogForm());

    expect(result.current.formData).toEqual({
      tail_number: '',
      jcn: '',
      discrepancy: '',
      repair: '',
      doc_number: '',
      personnelInput: '',
      isRedBall: false,
      shift: 'Days',
      g081Photo: '',
    });
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.editingLogId).toBeNull();
    expect(result.current.originalLogState).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('updates form data correctly', () => {
    const { result } = renderHook(() => useLogForm());

    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        tail_number: '85-0123',
        discrepancy: 'Engine malfunction',
        isRedBall: true,
      }));
    });

    expect(result.current.formData.tail_number).toBe('85-0123');
    expect(result.current.formData.discrepancy).toBe('Engine malfunction');
    expect(result.current.formData.isRedBall).toBe(true);
    expect(result.current.formData.jcn).toBe('');
  });

  it('opens and closes modal', () => {
    const { result } = renderHook(() => useLogForm());

    act(() => {
      result.current.setIsModalOpen(true);
    });
    expect(result.current.isModalOpen).toBe(true);

    act(() => {
      result.current.setIsModalOpen(false);
    });
    expect(result.current.isModalOpen).toBe(false);
  });

  it('sets editing state correctly', () => {
    const { result } = renderHook(() => useLogForm());
    const mockLog = {
      id: 'log-123',
      tail_number: '85-0123',
      jcn: 'JCN-456',
      discrepancy: 'Test discrepancy',
      repair: 'Test repair',
      doc_number: 'DOC-789',
      shopId: 'AVIONICS',
      amuId: 'BLACK' as const,
      technician_name: 'SSgt Smith',
      man_number: '1234567890',
      timestamp: new Date() as any,
    };

    act(() => {
      result.current.setEditingLogId('log-123');
      result.current.setOriginalLogState(mockLog);
    });

    expect(result.current.editingLogId).toBe('log-123');
    expect(result.current.originalLogState).toEqual(mockLog);
  });

  it('manages loading state', () => {
    const { result } = renderHook(() => useLogForm());

    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.loading).toBe(false);
  });

  it('resets form to initial state', () => {
    const { result } = renderHook(() => useLogForm());

    // Set some data
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        tail_number: '85-0123',
        discrepancy: 'Test',
      }));
      result.current.setEditingLogId('log-123');
      result.current.setOriginalLogState({ id: 'log-123' } as any);
      result.current.setIsModalOpen(true);
    });

    // Verify data is set
    expect(result.current.formData.tail_number).toBe('85-0123');
    expect(result.current.editingLogId).toBe('log-123');
    expect(result.current.isModalOpen).toBe(true);

    // Reset
    act(() => {
      result.current.resetForm();
    });

    // Verify reset
    expect(result.current.formData).toEqual({
      tail_number: '',
      jcn: '',
      discrepancy: '',
      repair: '',
      doc_number: '',
      personnelInput: '',
      isRedBall: false,
      shift: 'Days',
      g081Photo: '',
    });
    expect(result.current.editingLogId).toBeNull();
    expect(result.current.originalLogState).toBeNull();
  });

  it('handles personnel input parsing', () => {
    const { result } = renderHook(() => useLogForm());

    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        personnelInput: 'SSgt Smith, TSgt Jones, A1C Brown',
      }));
    });

    expect(result.current.formData.personnelInput).toBe('SSgt Smith, TSgt Jones, A1C Brown');

    // Test parsing (this would typically be done in the component)
    const personnel = result.current.formData.personnelInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    expect(personnel).toEqual(['SSgt Smith', 'TSgt Jones', 'A1C Brown']);
  });

  it('handles shift type changes', () => {
    const { result } = renderHook(() => useLogForm());

    expect(result.current.formData.shift).toBe('Days');

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, shift: 'Swings' }));
    });
    expect(result.current.formData.shift).toBe('Swings');

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, shift: 'Nights' }));
    });
    expect(result.current.formData.shift).toBe('Nights');

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, shift: 'Weekend Duty' }));
    });
    expect(result.current.formData.shift).toBe('Weekend Duty');
  });

  it('handles G081 photo upload', () => {
    const { result } = renderHook(() => useLogForm());
    const mockBase64Photo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    expect(result.current.formData.g081Photo).toBe('');

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, g081Photo: mockBase64Photo }));
    });

    expect(result.current.formData.g081Photo).toBe(mockBase64Photo);

    // Clear photo
    act(() => {
      result.current.setFormData((prev) => ({ ...prev, g081Photo: '' }));
    });

    expect(result.current.formData.g081Photo).toBe('');
  });
});
