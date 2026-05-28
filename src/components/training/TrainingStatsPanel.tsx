import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface TrainingStatsPanelProps {
  stats: {
    total: number;
    current: number;
    expiring: number;
    expired: number;
  };
}

export const TrainingStatsPanel: React.FC<TrainingStatsPanelProps> = ({ stats }) => {
  const cards = [
    {
      label: 'Total Trainings',
      value: stats.total,
      icon: CheckCircle,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Current',
      value: stats.current,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Expiring Soon',
      value: stats.expiring,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Expired',
      value: stats.expired,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
