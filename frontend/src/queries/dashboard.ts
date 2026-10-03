import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { chaves } from './chaves';

export const useResumoDoDashboard = () => useQuery({
  queryKey: chaves.resumoDoDashboard,
  queryFn: dashboardService.getSummary,
});
