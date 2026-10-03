import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { closePayroll, getMyPayslips, getPayroll, processPayroll, type MonthlyPayroll } from '../services/payrollService';
import { chaves } from './chaves';

// A folha de uma competência fica em cache: trocar de mês e voltar não refaz a chamada, e o filtro
// por setor trabalha sobre a folha já carregada.
export const useFolhaDaCompetencia = (competencia: string) => useQuery({
  queryKey: chaves.folhaDaCompetencia(competencia),
  queryFn: () => getPayroll(competencia),
});

// Processar e fechar devolvem a folha já atualizada: ela entra no cache sem nova chamada. Os
// holerites dos colaboradores só mudam com o fechamento.
export const useAcaoDaFolha = (competencia: string, acao: 'processar' | 'fechar') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => (acao === 'processar' ? processPayroll(competencia) : closePayroll(competencia)),
    onSuccess: (folha: MonthlyPayroll) => {
      queryClient.setQueryData(chaves.folhaDaCompetencia(competencia), folha);
      if (acao === 'fechar') return queryClient.invalidateQueries({ queryKey: chaves.meusHolerites });
      return undefined;
    },
  });
};

export const useMeusHolerites = () => useQuery({ queryKey: chaves.meusHolerites, queryFn: getMyPayslips });
