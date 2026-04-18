import React from 'react';
import { UserPresence } from '../../types';

interface PresenceIndicatorProps {
  users: UserPresence[];
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ users }) => {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {users.map(u => (
        <div 
          key={u.userId}
          className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center group relative cursor-help"
          title={`${u.userName} is also on this page`}
        >
          <span className="text-[10px] font-black text-slate-600">
            {u.userName.split(',')[0].slice(0, 2).toUpperCase()}
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-sidebar text-white text-[8px] font-black uppercase tracking-tighter rounded-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-[200]">
            {u.userName} <span className="text-primary/60 ml-1">// {u.location}</span>
          </div>
          <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white"></div>
        </div>
      ))}
      <span className="ml-4 text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">
        {users.length} {users.length === 1 ? 'other tech' : 'other techs'} active
      </span>
    </div>
  );
};
