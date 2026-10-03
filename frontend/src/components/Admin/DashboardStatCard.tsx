import React from 'react';
import { Link } from 'react-router-dom';

interface DashboardStatCardProps {
  label: string;
  value: number;
  to: string;
  icon: React.ReactNode;
  color: string;
  shadow: string;
  hint?: string;
}

const DashboardStatCard: React.FC<DashboardStatCardProps> = ({ label, value, to, icon, color, shadow, hint }) => {
  return (
    <Link
      to={to}
      className="block bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 ${color}`}></div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${color} ${shadow}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-4xl font-black text-slate-900 mb-1">{value}</h3>
          <p className="text-slate-500 font-semibold text-sm uppercase tracking-wider">{label}</p>
          {hint && <p className="text-slate-500 text-xs font-medium mt-1">{hint}</p>}
        </div>
      </div>
    </Link>
  );
};

export default DashboardStatCard;
