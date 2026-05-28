import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrainingData } from '../useTrainingData';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { LIST: 'list' },
}));

// Mock Auth Context
const mockProfile = {
  uid: 'user-123',
  name: 'SSgt Smith',
  rank: 'SSgt',
  man_number: '1234567890',
  shopId: 'AVIONICS',
  amuId: 'BLACK' as const,
  role: 'ncoic' as const,
  email: 'smith@us.af.mil',
  status: 'active' as const,
};

vi.mock('../../contexts/AuthContextInstance', () => ({
  useAuth: () => ({ profile: mockProfile, isDemoMode: true }),
}));

const mockTraining = [
  {
    id: 'training-1',
    man_number: '1234567890',
    course_name: 'F-15E Aircraft Systems',
    course_code: 'AETC-001',
    due_date: '2026-12-31',
    shopId: 'AVIONICS',
    amuId: 'BLACK',
    status: 'current',
  },
  {
    id: 'training-2',
    man_number: '1234567890',
    course_name: 'Safety Training',
    course_code: 'SAF-101',
    due_date: '2026-02-15',
    shopId: 'AVIONICS',
    amuId: 'BLACK',
    status: 'expiring',
  },
  {
    id: 'training-3',
    man_number: '0987654321',
    course_name: 'Leadership Course',
    course_code: 'LEAD-200',
    due_date: '2025-01-01',
    shopId: 'AVIONICS',
    amuId: 'BLACK',
    status: 'expired',
  },
  {
    id: 'training-4',
    man_number: '1122334455',
    course_name: 'Crew Chief Qualification',
    course_code: 'CC-300',
    due_date: '2026-08-15',
    shopId: 'CREW_CHIEFS',
    amuId: 'GREEN',
    status: 'current',
  },
];

// Mock DemoDataProvider to return unfiltered demo data directly
vi.mock('../../contexts/DemoDataProvider', () => ({
  useDemoData: () => ({
    isDemo: true,
    logs: [],
    difm: [],
    personnel: [],
    training: mockTraining,
  }),
  DemoDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('useTrainingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns training data in demo mode', () => {
    const { result } = renderHook(() => useTrainingData());
    expect(result.current.trainings).toHaveLength(4);
    expect(result.current.loading).toBe(false);
  });

  it('filters training by search query', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setSearchQuery('Aircraft');
    });

    expect(result.current.searchQuery).toBe('Aircraft');
    expect(
      result.current.filteredTrainings.every((t) =>
        t.course_name.toLowerCase().includes('aircraft')
      )
    ).toBe(true);
  });

  it('filters training by man number', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setSearchQuery('1234567890');
    });

    expect(result.current.filteredTrainings.every((t) => t.man_number === '1234567890')).toBe(true);
  });

  it('filters training by status', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setStatusFilter('expired');
    });

    expect(result.current.statusFilter).toBe('expired');
    expect(result.current.filteredTrainings.every((t) => t.status === 'expired')).toBe(true);
  });

  it('filters training by date range', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setStartDate('2026-01-01');
      result.current.setEndDate('2026-12-31');
    });

    expect(result.current.startDate).toBe('2026-01-01');
    expect(result.current.endDate).toBe('2026-12-31');

    result.current.filteredTrainings.forEach((t) => {
      const dueDate = new Date(t.due_date);
      expect(dueDate >= new Date('2026-01-01')).toBe(true);
      expect(dueDate <= new Date('2026-12-31')).toBe(true);
    });
  });

  it('combines multiple filters', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setSearchQuery('1234567890');
      result.current.setStatusFilter('current');
    });

    expect(
      result.current.filteredTrainings.every(
        (t) => t.man_number === '1234567890' && t.status === 'current'
      )
    ).toBe(true);
  });

  it('calculates stats correctly', () => {
    const { result } = renderHook(() => useTrainingData());
    expect(result.current.stats.total).toBe(4);
    expect(result.current.stats.current).toBe(2);
    expect(result.current.stats.expiring).toBe(1);
    expect(result.current.stats.expired).toBe(1);
  });

  it('handles pagination', () => {
    const { result } = renderHook(() => useTrainingData());
    const initialLength = result.current.filteredTrainings.length;

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.filteredTrainings.length).toBeGreaterThanOrEqual(initialLength);
  });

  it('resets filters when cleared', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setSearchQuery('Aircraft');
      result.current.setStatusFilter('expired');
      result.current.setStartDate('2026-01-01');
    });

    const filteredCount = result.current.filteredTrainings.length;

    act(() => {
      result.current.setSearchQuery('');
      result.current.setStatusFilter('all');
      result.current.setStartDate('');
      result.current.setEndDate('');
    });

    expect(result.current.filteredTrainings.length).toBeGreaterThan(filteredCount);
  });

  it('returns empty array when no trainings match filters', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setSearchQuery('NonExistentCourse12345');
    });

    expect(result.current.filteredTrainings).toHaveLength(0);
  });

  it('handles course code search', () => {
    const { result } = renderHook(() => useTrainingData());

    act(() => {
      result.current.setSearchQuery('AETC');
    });

    expect(
      result.current.filteredTrainings.some((t) => t.course_code && t.course_code.includes('AETC'))
    ).toBe(true);
  });
});
