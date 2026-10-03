import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditoriaService, type AuditoriaQuery } from '../services/auditoriaService';
import { chaves } from './chaves';

export const useAuditoria = (consulta: AuditoriaQuery) => useQuery({
  queryKey: chaves.paginaDeAuditoria(consulta),
  queryFn: () => auditoriaService.getPage(consulta),
  placeholderData: keepPreviousData,
});

// Só consulta quando há um colaborador escolhido.
export const useHistoricoContratual = (funcionarioId: number | null) => useQuery({
  queryKey: chaves.historicoContratual(funcionarioId ?? 0),
  queryFn: () => auditoriaService.getContractHistory(funcionarioId as number),
  enabled: funcionarioId !== null,
});
