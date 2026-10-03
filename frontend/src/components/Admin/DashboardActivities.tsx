import React from 'react';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

interface DashboardActivitiesProps {
  isLoading: boolean;
}

const DashboardActivities: React.FC<DashboardActivitiesProps> = ({ isLoading }) => (
  <Card as="section" padding="lg" aria-labelledby="atividades-recentes">
    <h2 id="atividades-recentes" className="mb-6 text-xl font-bold tracking-tight text-ink">Atividades Recentes</h2>
    {isLoading ? (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-ink-muted">O histórico de atividades da empresa ainda não está disponível.</p>
    )}
  </Card>
);

export default DashboardActivities;
