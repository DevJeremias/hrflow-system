import React from 'react';
import { DashboardData } from '../../services/dashboardService';

interface Props {
  activities?: DashboardData['recentActivities'];
  isLoading: boolean;
}

const RecentActivities: React.FC<Props> = ({ activities, isLoading }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
      <h2 className="text-xl font-black text-slate-900 tracking-tight mb-8">Atividades Recentes</h2>
      <div className="space-y-6">
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
          activities?.map((activity) => (
            <div key={activity.id} className="flex gap-4">
              <div className={`w-2 h-2 mt-2 rounded-full ${activity.color} shrink-0`} />
              <div>
                <p className="text-sm font-bold text-slate-900">{activity.title}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">{activity.description}</p>
                <p className="text-xs text-slate-400 mt-1">{activity.timeAgo}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentActivities;