import React from 'react';
import { Search } from 'lucide-react';

interface LogSearchFilterProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
}

export const LogSearchFilter: React.FC<LogSearchFilterProps> = ({
  searchQuery,
  onSearchChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-0 visible-grid bg-surface">
      <div className="flex-1 relative p-4">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant z-10" />
        <input
          type="text"
          placeholder="Search by tail, name, man#, JCN, or discrepancy..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="sleek-input pl-12 w-full !border-none !bg-transparent relative z-0"
        />
      </div>
      <div className="flex gap-0">
        <div className="flex flex-col p-4 border-l border-outline">
          <span className="tech-label mb-2">Start Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
          />
        </div>
        <div className="flex flex-col p-4 border-l border-outline">
          <span className="tech-label mb-2">End Date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="sleek-input !py-1 !px-0 !border-none !bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};
