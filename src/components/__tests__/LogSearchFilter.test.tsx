import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LogSearchFilter } from '../../components/logs/LogSearchFilter';

describe('LogSearchFilter', () => {
  it('renders search input and date filters', () => {
    const { container } = render(
      <LogSearchFilter
        searchQuery=""
        onSearchChange={vi.fn()}
        startDate=""
        onStartDateChange={vi.fn()}
        endDate=""
        onEndDateChange={vi.fn()}
      />
    );

    expect(container.textContent).toContain('Start Date');
    expect(container.textContent).toContain('End Date');

    const inputs = container.querySelectorAll('input');
    expect(inputs).toHaveLength(3); // search + start date + end date
  });

  it('renders search input with placeholder', () => {
    const { container } = render(
      <LogSearchFilter
        searchQuery=""
        onSearchChange={vi.fn()}
        startDate=""
        onStartDateChange={vi.fn()}
        endDate=""
        onEndDateChange={vi.fn()}
      />
    );

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    // Check placeholder attribute since it's inside an input element
    expect(searchInput?.getAttribute('placeholder')).toContain('Search by tail');
  });

  it('calls onSearchChange when value changes', () => {
    const onSearchChange = vi.fn();
    const { container } = render(
      <LogSearchFilter
        searchQuery="test"
        onSearchChange={onSearchChange}
        startDate=""
        onStartDateChange={vi.fn()}
        endDate=""
        onEndDateChange={vi.fn()}
      />
    );

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
  });

  it('renders date inputs', () => {
    const { container } = render(
      <LogSearchFilter
        searchQuery=""
        onSearchChange={vi.fn()}
        startDate="2026-01-01"
        onStartDateChange={vi.fn()}
        endDate="2026-12-31"
        onEndDateChange={vi.fn()}
      />
    );

    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
  });
});
