import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pontoService, type CompanyPointQuery, type HistoryDay } from '../services/pontoService';
import { chaves } from './chaves';

export const usePontoDaEmpresa = (consulta: Required<CompanyPointQuery>) => useQuery({
  queryKey: chaves.pontoDaEmpresa(consulta),
  queryFn: () => pontoService.getRegistrosDaEmpresa(consulta),
  placeholderData: keepPreviousData,
});

// Sem vínculo com um colaborador não há o que consultar: as três consultas esperam o id.
export const usePontoDeHoje = (funcionarioId: number | null) => useQuery({
  queryKey: chaves.pontoDeHoje(funcionarioId ?? 0),
  queryFn: () => pontoService.getRegistrosHoje(funcionarioId as number),
  enabled: funcionarioId !== null,
});

export const useHistoricoDoMes = (funcionarioId: number | null, mes: string) => useQuery({
  queryKey: chaves.historicoDoMes(funcionarioId ?? 0, mes),
  queryFn: () => pontoService.getHistoricoMes(funcionarioId as number, mes),
  enabled: funcionarioId !== null,
  placeholderData: keepPreviousData,
});

export const useTotaisDoMes = (funcionarioId: number | null, mes: string) => useQuery({
  queryKey: chaves.totaisDoMes(funcionarioId ?? 0, mes),
  queryFn: () => pontoService.getTotaisSemanais(funcionarioId as number, mes),
  enabled: funcionarioId !== null,
  placeholderData: keepPreviousData,
});

// Uma marcação nova muda o dia, o espelho do mês e as marcações de hoje do dashboard do RH.
export const useRegistrarPonto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, localizacao }: { tipo: string; localizacao?: { lat: number; lng: number } }) =>
      pontoService.registrar(tipo, localizacao),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.ponto }),
      queryClient.invalidateQueries({ queryKey: chaves.dashboard }),
    ]),
  });
};

export const useSalvarJustificativa = (funcionarioId: number | null, mes: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, texto }: { data: string; texto: string }) => pontoService.salvarJustificativa(data, texto),
    // A lista só muda depois que o servidor confirma a gravação.
    onSuccess: (_, { data, texto }) => {
      queryClient.setQueryData<HistoryDay[]>(chaves.historicoDoMes(funcionarioId ?? 0, mes), (dias) =>
        dias?.map((dia) => (dia.id === data ? { ...dia, note: texto.trim() } : dia)));
    },
  });
};
