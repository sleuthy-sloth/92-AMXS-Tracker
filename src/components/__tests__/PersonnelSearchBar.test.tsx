import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonnelSearchBar } from '../personnel/PersonnelSearchBar';

describe('PersonnelSearchBar', () => {
  it('renders with no query', () => {
    const { container } = render(
      <PersonnelSearchBar
        searchQuery=""
        onSearchChange={() => {}}
        shopFilter="all"
        onShopFilterChange={() => {}}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with a query', () => {
    const { container } = render(
      <PersonnelSearchBar
        searchQuery="DOE"
        onSearchChange={() => {}}
        shopFilter="all"
        onShopFilterChange={() => {}}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('calls onSearchChange when typing', () => {
    const onChange = vi.fn();
    render(
      <PersonnelSearchBar
        searchQuery=""
        onSearchChange={onChange}
        shopFilter="all"
        onShopFilterChange={() => {}}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('calls onShopFilterChange when selecting shop', () => {
    const onShopChange = vi.fn();
    render(
      <PersonnelSearchBar
        searchQuery=""
        onSearchChange={() => {}}
        shopFilter="all"
        onShopFilterChange={onShopChange}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'JETS' } });
    expect(onShopChange).toHaveBeenCalledWith('JETS');
  });
});
