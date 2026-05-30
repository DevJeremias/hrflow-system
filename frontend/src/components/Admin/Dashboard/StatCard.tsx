import React from 'react';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  shadow: string;
  alert?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, shadow, alert }) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 ${color}`}></div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${color} ${shadow}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-4xl font-black text-slate-900 mb-1">{value}</h3>
          <p className="text-slate-500 font-semibold text-sm uppercase tracking-wider">{label}</p>
        </div>
      </div>
      {alert && value > 0 && (
        <div className="absolute top-6 right-6 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
        </div>
      )}
    </div>
  );
};

export default StatCard;