import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeService, type Employee, type EmployeeForm, type EmployeeQuery } from '../services/employeeService';
import { chaves } from './chaves';

// Mantém a página anterior na tela enquanto a nova chega: trocar de página ou digitar na busca
// não pisca a tabela.
export const useFuncionarios = (consulta: EmployeeQuery) => useQuery({
  queryKey: chaves.paginaDeFuncionarios(consulta),
  queryFn: () => employeeService.getPage(consulta),
  placeholderData: keepPreviousData,
});

// Cadastro, edição, desligamento e exclusão mudam o que a folha, o dashboard e as contagens da
// estrutura mostram. As ações do ciclo de vida (modal próprio) a chamam ao terminar.
export const useInvalidarPorColaboradores = () => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: chaves.funcionarios }),
    queryClient.invalidateQueries({ queryKey: chaves.folha }),
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
