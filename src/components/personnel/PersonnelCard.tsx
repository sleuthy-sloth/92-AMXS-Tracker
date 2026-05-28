import React from 'react';
import { motion } from 'motion/react';
import { Users, UserCheck, UserClock } from 'lucide-react';

interface PersonnelCardProps {
  stats: {
    total: number;
    active: number;
    pending: number;
  };
}

export const PersonnelCard: React.FC<PersonnelCardProps> = ({ stats }) => {
  const cards = [
    {
      label: 'Total Personnel',
      value: stats.total,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Active',
      value: stats.active,
      icon: UserCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Pending Approval',
      value: stats.pending,
      icon: UserClock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, idx) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className={`${card.bgColor} rounded-lg p-6 border border-outline`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="tech-label text-xs font-bold uppercase tracking-wider">
              {card.label}
            </span>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div className={`text-3xl font-black ${card.color}`}>{card.value}</div>
        </motion.div>
      ))}
    </div>
  );
};
