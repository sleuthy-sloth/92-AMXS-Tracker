import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PersonnelCard } from '../../components/personnel/PersonnelCard';

// Mock motion
vi.mock('motion/react', () => ({
  motion: Object.fromEntries(
    ['div', 'span'].map((el) => [
      el,
      (props: any) => {
        const { initial, animate, exit, transition, ...rest } = props;
        const Component = el === 'span' ? 'span' : 'div';
        return <Component {...rest} />;
      },
    ])
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Users: (props: any) => <span {...props}>Users</span>,
  UserCheck: (props: any) => <span {...props}>UserCheck</span>,
  UserClock: (props: any) => <span {...props}>UserClock</span>,
  Search: (props: any) => <span {...props}>Search</span>,
  X: (props: any) => <span {...props}>X</span>,
  Mail: (props: any) => <span {...props}>Mail</span>,
  Phone: (props: any) => <span {...props}>Phone</span>,
}));

describe('PersonnelCard', () => {
  const stats = {
    total: 25,
    active: 20,
    pending: 5,
  };

  it('renders all three stat cards', () => {
    const { container } = render(<PersonnelCard stats={stats} />);

    expect(container.textContent).toContain('Total Personnel');
    expect(container.textContent).toContain('25');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('20');
    expect(container.textContent).toContain('Pending Approval');
    expect(container.textContent).toContain('5');
  });

  it('renders correctly with zero pending', () => {
    const noPending = {
      total: 10,
      active: 10,
      pending: 0,
    };

    const { container } = render(<PersonnelCard stats={noPending} />);

    expect(container.textContent).toContain('10');
    expect(container.textContent).toContain('0');
  });

  it('renders correctly with all pending', () => {
    const allPending = {
      total: 3,
      active: 0,
      pending: 3,
    };

    const { container } = render(<PersonnelCard stats={allPending} />);

    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('0');
  });
});
