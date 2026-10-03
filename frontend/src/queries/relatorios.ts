import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { relatoriosService } from '../services/relatoriosService';
import { chaves } from './chaves';

// Os relatórios mudam pouco enquanto a tela está aberta, e trocar de aba e voltar não deve refazer a conta.
const PRAZO_DO_RELATORIO_MS = 60_000;

export const useHeadcount = (de: string, ate: string) => useQuery({
  queryKey: chaves.headcount(de, ate),
  queryFn: () => relatoriosService.getHeadcount(de, ate),
  placeholderData: keepPreviousData,
  staleTime: PRAZO_DO_RELATORIO_MS,
});

export const useAniversariantes = (mes: string) => useQuery({
  queryKey: chaves.aniversariantes(mes),
  queryFn: () => relatoriosService.getAniversariantes(mes),
  placeholderData: keepPreviousData,
  staleTime: PRAZO_DO_RELATORIO_MS,
});

export const useCustoPorDepartamento = (competencia: string) => useQuery({
  queryKey: chaves.custoPorDepartamento(competencia),
  queryFn: () => relatoriosService.getCustoPorDepartamento(competencia),
  placeholderData: keepPreviousData,
  staleTime: PRAZO_DO_RELATORIO_MS,
  // Folha ainda não processada é 404: não adianta tentar de novo.
  retry: false,
});

export const useAbsenteismo = (mes: string) => useQuery({
  queryKey: chaves.absenteismo(mes),
  queryFn: () => relatoriosService.getAbsenteismo(mes),
  placeholderData: keepPreviousData,
  staleTime: PRAZO_DO_RELATORIO_MS,
});
