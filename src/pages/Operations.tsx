import React from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Wrench, FileDown, Camera, FileText } from 'lucide-react';
import { MaintenanceLogs } from './MaintenanceLogs';
import { DIFMLogs } from './DIFMLogs';
import { G081Gallery } from './G081Gallery';
import { ReferenceDocs } from './ReferenceDocs';
import { cn } from '../lib/utils';

const TABS = [
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'difm', label: 'DIFM', icon: FileDown },
  { key: 'g081', label: 'G081 Gallery', icon: Camera },
  { key: 'reference-docs', label: 'Reference Docs', icon: FileText },
] as const;

export const Operations: React.FC = () => {
  const location = useLocation();
  const activeKey =
    TABS.find((t) => location.pathname.startsWith(`/ops/${t.key}`))?.key ?? 'maintenance';

  return (
    <div className="flex flex-col">
      <div className="px-8 pt-2 border-b border-outline">
        <nav className="flex gap-1" role="tablist">
          {TABS.map((tab) => {
            const isActive = tab.key === activeKey;
            return (
              <Link
                key={tab.key}
                to={`/ops/${tab.key}`}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2',
                  isActive
                    ? 'text-primary border-primary'
                    : 'text-slate-500 border-transparent hover:text-slate-900 hover:border-slate-300'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Routes>
        <Route index element={<Navigate to="maintenance" replace />} />
        <Route path="maintenance" element={<MaintenanceLogs />} />
        <Route path="difm" element={<DIFMLogs />} />
        <Route path="g081" element={<G081Gallery />} />
        <Route path="reference-docs" element={<ReferenceDocs />} />
        <Route path="*" element={<Navigate to="maintenance" replace />} />
      </Routes>
    </div>
  );
};
