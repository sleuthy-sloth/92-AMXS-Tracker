import React from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const PendingApproval: React.FC = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-slate-50 border border-outline flex items-center justify-center">
            <Clock className="text-primary w-12 h-12" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-slate-900">Access Pending</h1>
            <p className="serif-header text-lg mt-2 text-slate-600">Your account is currently awaiting NCOIC verification.</p>
          </div>
        </div>
        
        <div className="visible-grid bg-surface p-10 space-y-8 shadow-xl">
          <p className="serif-header text-sm leading-relaxed text-slate-600">
            Once an administrator assigns your shop and validates your man number, you will be granted full operational access to the system.
          </p>
          <button 
            onClick={logout}
            className="sleek-button w-full py-4 bg-transparent !text-slate-900 border border-outline hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
