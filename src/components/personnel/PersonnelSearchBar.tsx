import React from 'react';
import { Search } from 'lucide-react';
import { SHOPS } from '../../types';

interface PersonnelSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  shopFilter: string;
  onShopFilterChange: (shop: string) => void;
}

export const PersonnelSearchBar: React.FC<PersonnelSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  shopFilter,
  onShopFilterChange,
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, MAN #, or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="sleek-input pl-12 w-full"
        />
      </div>
      <select
        value={shopFilter}
        onChange={(e) => onShopFilterChange(e.target.value)}
        className="sleek-input md:w-48"
      >
        <option value="all">All Shops</option>
        {SHOPS.map((shop) => (
          <option key={shop} value={shop}>
            {shop}
          </option>
        ))}
      </select>
    </div>
  );
};
