import React from 'react';

interface DashboardActivitiesProps {
  isLoading: boolean;
}

const DashboardActivities: React.FC<DashboardActivitiesProps> = ({ isLoading }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
      <h2 className="text-xl font-black text-slate-900 tracking-tight mb-8">Atividades Recentes</h2>
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2 w-full">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-500">O histórico de atividades da empresa ainda não está disponível.</p>
      )}
    </div>
  );
};

export default DashboardActivities;
