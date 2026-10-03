import { useQuery } from '@tanstack/react-query';
import { requestService } from '../services/requestService';
import { chaves } from './chaves';

export const useMinhasSolicitacoes = () => useQuery({
  queryKey: chaves.solicitacoes,
  queryFn: requestService.getMyRequests,
});
