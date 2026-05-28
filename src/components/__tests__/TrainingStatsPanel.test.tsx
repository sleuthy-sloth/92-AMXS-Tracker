import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TrainingStatsPanel } from '../../components/training/TrainingStatsPanel';

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

describe('TrainingStatsPanel', () => {
  const stats = {
    total: 50,
    current: 30,
    expiring: 12,
    expired: 8,
  };

  it('renders all four stat cards', () => {
    const { container } = render(<TrainingStatsPanel stats={stats} />);

    expect(container.textContent).toContain('Total Trainings');
    expect(container.textContent).toContain('50');
    expect(container.textContent).toContain('Current');
    expect(container.textContent).toContain('30');
    expect(container.textContent).toContain('Expiring Soon');
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('Expired');
    expect(container.textContent).toContain('8');
  });

  it('renders correctly with empty stats', () => {
    const emptyStats = {
      total: 0,
      current: 0,
      expiring: 0,
      expired: 0,
    };

    const { container } = render(<TrainingStatsPanel stats={emptyStats} />);

    expect(container.textContent).toContain('0');
    // All values should be 0
    const zeroCounts = container.textContent?.match(/0/g);
    expect(zeroCounts?.length).toBe(4);
  });

  it('renders correctly with only current trainings', () => {
    const onlyCurrent = {
      total: 10,
      current: 10,
      expiring: 0,
      expired: 0,
    };

    const { container } = render(<TrainingStatsPanel stats={onlyCurrent} />);

    expect(container.textContent).toContain('10');
    expect(container.textContent).toContain('0');
  });
});
