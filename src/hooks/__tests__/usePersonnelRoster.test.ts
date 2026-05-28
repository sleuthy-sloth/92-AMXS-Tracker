import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersonnelRoster } from '../usePersonnelRoster';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
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

const mockPersonnel = [
  {
    uid: 'person-1',
    name: 'SSgt Smith',
    rank: 'SSgt',
    man_number: '1234567890',
    shopId: 'AVIONICS',
    amuId: 'BLACK',
    role: 'ncoic',
    email: 'smith@us.af.mil',
    status: 'active',
  },
  {
    uid: 'person-2',
    name: 'TSgt Jones',
    rank: 'TSgt',
    man_number: '0987654321',
    shopId: 'AVIONICS',
    amuId: 'BLACK',
    role: 'technician',
    email: 'jones@us.af.mil',
    status: 'active',
  },
  {
    uid: 'person-3',
    name: 'A1C Brown',
    rank: 'A1C',
    man_number: '1122334455',
    shopId: 'CREW_CHIEFS',
    amuId: 'GREEN',
    role: 'technician',
    email: 'brown@us.af.mil',
    status: 'pending',
  },
];

// Mock DemoDataProvider to return unfiltered demo data directly
vi.mock('../../contexts/DemoDataProvider', () => ({
  useDemoData: () => ({
    isDemo: true,
    logs: [],
    difm: [],
    personnel: mockPersonnel,
    training: [],
  }),
  DemoDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('usePersonnelRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns personnel data in demo mode', () => {
    const { result } = renderHook(() => usePersonnelRoster());
    expect(result.current.personnel).toHaveLength(3);
    expect(result.current.loading).toBe(false);
  });

  it('filters personnel by shop', () => {
    const { result } = renderHook(() => usePersonnelRoster());
    expect(result.current.filteredPersonnel.length).toBeGreaterThan(0);

    act(() => {
      result.current.setShopFilter('CREW_CHIEFS');
    });

    expect(result.current.shopFilter).toBe('CREW_CHIEFS');
    expect(result.current.filteredPersonnel.every((p) => p.shopId === 'CREW_CHIEFS')).toBe(true);
  });

  it('filters personnel by search query', () => {
    const { result } = renderHook(() => usePersonnelRoster());

    act(() => {
      result.current.setSearchQuery('Smith');
    });

    expect(result.current.searchQuery).toBe('Smith');
    expect(
      result.current.filteredPersonnel.every(
        (p) =>
          p.name.toLowerCase().includes('smith') ||
          p.man_number.includes('Smith') ||
          p.email.toLowerCase().includes('smith')
      )
    ).toBe(true);
  });

  it('filters personnel by man number', () => {
    const { result } = renderHook(() => usePersonnelRoster());

    act(() => {
      result.current.setSearchQuery('1234567890');
    });

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].man_number).toBe('1234567890');
  });

  it('combines search and shop filters', () => {
    const { result } = renderHook(() => usePersonnelRoster());

    act(() => {
      result.current.setShopFilter('AVIONICS');
      result.current.setSearchQuery('TSgt');
    });

    expect(result.current.filteredPersonnel.every((p) => p.shopId === 'AVIONICS')).toBe(true);
    expect(
      result.current.filteredPersonnel.every(
        (p) => p.name.toLowerCase().includes('tsgt') || p.rank.toLowerCase().includes('tsgt')
      )
    ).toBe(true);
  });

  it('calculates stats correctly', () => {
    const { result } = renderHook(() => usePersonnelRoster());
    expect(result.current.stats.total).toBe(3);
    expect(result.current.stats.active).toBe(2);
    expect(result.current.stats.pending).toBe(1);
  });

  it('handles pagination', () => {
    const { result } = renderHook(() => usePersonnelRoster());
    const initialLength = result.current.filteredPersonnel.length;

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.filteredPersonnel.length).toBeGreaterThanOrEqual(initialLength);
  });

  it('resets search when query is cleared', () => {
    const { result } = renderHook(() => usePersonnelRoster());

    act(() => {
      result.current.setSearchQuery('Smith');
    });
    const filteredCount = result.current.filteredPersonnel.length;

    act(() => {
      result.current.setSearchQuery('');
    });

    expect(result.current.filteredPersonnel.length).toBeGreaterThan(filteredCount);
  });

  it('resets shop filter to all', () => {
    const { result } = renderHook(() => usePersonnelRoster());

    act(() => {
      result.current.setShopFilter('CREW_CHIEFS');
    });
    expect(result.current.shopFilter).toBe('CREW_CHIEFS');

    act(() => {
      result.current.setShopFilter('all');
    });
    expect(result.current.shopFilter).toBe('all');
  });
});
