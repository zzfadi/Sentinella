import React from 'react';
import { MonitoringTier, RiskLevel } from '../types';

interface StatusBadgeProps {
  type: 'tier' | 'risk';
  value: MonitoringTier | RiskLevel;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value }) => {
  let colorClass = 'bg-slate-100 text-slate-500';
  
  if (type === 'risk') {
    switch (value) {
      case RiskLevel.SAFE: colorClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100'; break;
      case RiskLevel.CAUTION: colorClass = 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'; break;
      case RiskLevel.DANGER: colorClass = 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'; break;
    }
  } else {
    switch (value) {
      case MonitoringTier.OFF: colorClass = 'bg-slate-100 text-slate-400 border border-slate-200'; break;
      case MonitoringTier.WATCHDOG: colorClass = 'bg-blue-50 text-blue-600 border border-blue-100'; break;
      case MonitoringTier.ANALYZER: colorClass = 'bg-violet-50 text-violet-600 border border-violet-100'; break;
      case MonitoringTier.EXPERT: colorClass = 'bg-rose-50 text-rose-600 border border-rose-100'; break;
    }
  }

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${colorClass}`}>
      {value}
    </span>
  );
};

export default StatusBadge;