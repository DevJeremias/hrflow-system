import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeService, type DependentForm, type Employee, type EmployeeForm, type EmployeeQuery } from '../services/employeeService';
import { chaves } from './chaves';

// Mantém a página anterior na tela enquanto a nova chega: trocar de página ou digitar na busca
// não pisca a tabela.
export const useFuncionarios = (consulta: EmployeeQuery) => useQuery({
  queryKey: chaves.paginaDeFuncionarios(consulta),
  queryFn: () => employeeService.getPage(consulta),
  placeholderData: keepPreviousData,
});

// Cadastro, edição, desligamento e exclusão mudam o que o dashboard e as contagens da estrutura
// mostram (a folha processada só muda quando o RH a processa de novo). As ações do ciclo de vida (modal próprio) a chamam ao terminar.
export const useInvalidarPorColaboradores = () => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: chaves.funcionarios }),
    queryClient.invalidateQueries({ queryKey: chaves.dashboard }),
    // Só as contagens da estrutura mudam: marca como desatualizada e deixa a tela de estrutura
    // buscar ao abrir. O modal do colaborador, aberto na hora, não precisa refazer cargos e departamentos.
    queryClient.invalidateQueries({ queryKey: chaves.estrutura, refetchType: 'none' }),
  ]);
};

export const useSalvarColaborador = () => {
  const invalidar = useInvalidarPorColaboradores();
  return useMutation({
    mutationFn: ({ dados, original }: { dados: EmployeeForm; original: Employee | null }) =>
      employeeService.saveEditingStatus(dados, original),
    onSuccess: invalidar,
  });
};

export const useDependentes = (funcionarioId: string | undefined) => useQuery({
  queryKey: chaves.dependentes(funcionarioId ?? ''),
  queryFn: () => employeeService.getDependents(funcionarioId as string),
  enabled: Boolean(funcionarioId),
});

// Dependente não muda a listagem de colaboradores: só a própria lista do colaborador.
export const useSalvarDependente = (funcionarioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dados, dependenteId }: { dados: DependentForm; dependenteId?: string }) =>
      employeeService.saveDependent(funcionarioId, dados, dependenteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.dependentes(funcionarioId) }),
  });
};

export const useExcluirDependente = (funcionarioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependenteId: string) => employeeService.deleteDependent(funcionarioId, dependenteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.dependentes(funcionarioId) }),
  });
};

export const useImportarColaboradores = () => {
  const invalidar = useInvalidarPorColaboradores();
  return useMutation({
    mutationFn: (csv: string) => employeeService.importCsv(csv),
    onSuccess: invalidar,
  });
};
