import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LogCard } from '../logs/LogCard';
import type { MaintenanceLog } from '../../types';

vi.mock('motion/react', () => ({
  motion: Object.fromEntries(
    ['div', 'span', 'p', 'button'].map((el) => [
      el,
      (props: any) => {
        const { initial, animate, exit, transition, ...rest } = props;
        return <div {...rest} />;
      },
    ])
  ),
}));

const baseLog: MaintenanceLog = {
  id: 'test-001',
  man_number: '12345',
  tail_number: '62-3551',
  jcn: 'JCN-2024-001',
  discrepancy: 'Left engine oil leak detected during pre-flight inspection.',
  repair: 'Replaced O-ring seal on oil line fitting.',
  technician_name: 'DOE, J',
  doc_number: 'DOC-001',
  shift: 'Days',
  timestamp: {
    seconds: 1700000000,
    nanoseconds: 0,
    toDate: () => new Date(1700000000 * 1000),
  } as any,
  isRedBall: false,
  shopId: 'CREW_CHIEFS',
  amuId: 'BLACK',
};

describe('LogCard', () => {
  it('renders basic log card', () => {
    const { container } = render(<LogCard log={baseLog} index={0} onClick={() => {}} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders red ball status', () => {
    const log = { ...baseLog, isRedBall: true };
    const { container } = render(<LogCard log={log} index={0} onClick={() => {}} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('shows G081 verified status', () => {
    const log = {
      ...baseLog,
      g081_photo: 'data:image/png;base64,...',
      g081_status: 'verified' as const,
    };
    const { container } = render(<LogCard log={log} index={0} onClick={() => {}} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('shows editing state when another user is editing', () => {
    const log = { ...baseLog, editingBy: 'user-other', editingByName: 'SMITH, A' };
    const { container } = render(
      <LogCard log={log} index={0} currentUserId="user-me" onClick={() => {}} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders without jcn using id fallback', () => {
    const log = { ...baseLog, jcn: '', id: 'abc123-def456' };
    const { container } = render(<LogCard log={log} index={0} onClick={() => {}} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
