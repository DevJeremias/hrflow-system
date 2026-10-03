import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { closePayroll, getMyPayslips, getPayroll, processPayroll, savePayrollEntries, type MonthlyPayroll, type PayrollEntries } from '../services/payrollService';
import { addDependent, getDependents, removeDependent, type NewDependent } from '../services/dependentsService';
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

// O servidor recalcula só o holerite do colaborador, mas os totais da folha mudam com ele: a folha
// da competência é lida de novo e a mutação só termina depois, para a tela já mostrar os valores novos.
export const useSalvarLancamentos = (competencia: string, funcionarioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lancamentos: PayrollEntries) => savePayrollEntries(competencia, funcionarioId, lancamentos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.folhaDaCompetencia(competencia) }),
  });
};

export const useDependentes = (funcionarioId: string) => useQuery({
  queryKey: chaves.dependentes(funcionarioId),
  queryFn: () => getDependents(funcionarioId),
});

// Um dependente só entra no IRRF quando a folha é processada de novo: o cache da folha não muda aqui.
export const useAdicionarDependente = (funcionarioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependente: NewDependent) => addDependent(funcionarioId, dependente),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.dependentes(funcionarioId) }),
  });
};

export const useRemoverDependente = (funcionarioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependenteId: number) => removeDependent(funcionarioId, dependenteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.dependentes(funcionarioId) }),
  });
};
