import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteDepartment, deleteRole, getDepartments, getRoles, saveDepartment, saveRole,
  type DepartmentForm, type RoleForm,
} from '../services/departmentsRolesService';
import { chaves } from './chaves';

export const useDepartamentos = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: chaves.departamentos, queryFn: getDepartments, enabled });

export const useCargos = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: chaves.cargos, queryFn: getRoles, enabled });

// Departamento e cargo aparecem nos colaboradores e nas contagens do dashboard.
const useInvalidarPorEstrutura = () => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: chaves.estrutura }),
    queryClient.invalidateQueries({ queryKey: chaves.funcionarios }),
    queryClient.invalidateQueries({ queryKey: chaves.dashboard }),
  ]);
};

export const useSalvarDepartamento = () => {
  const invalidar = useInvalidarPorEstrutura();
  return useMutation({ mutationFn: (dados: DepartmentForm) => saveDepartment(dados), onSuccess: invalidar });
};

export const useSalvarCargo = () => {
  const invalidar = useInvalidarPorEstrutura();
  return useMutation({ mutationFn: (dados: RoleForm) => saveRole(dados), onSuccess: invalidar });
};

export const useExcluirDepartamento = () => {
  const invalidar = useInvalidarPorEstrutura();
  return useMutation({ mutationFn: (id: string) => deleteDepartment(id), onSuccess: invalidar });
};

export const useExcluirCargo = () => {
  const invalidar = useInvalidarPorEstrutura();
  return useMutation({ mutationFn: (id: string) => deleteRole(id), onSuccess: invalidar });
};
