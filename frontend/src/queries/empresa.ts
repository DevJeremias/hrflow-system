import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompany, saveCompany, type CompanyData } from '../services/empresaService';
import { chaves } from './chaves';

export const useEmpresa = () => useQuery({ queryKey: chaves.empresa, queryFn: getCompany });

// A API devolve a empresa gravada: ela entra no cache sem nova chamada.
export const useSalvarEmpresa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: CompanyData) => saveCompany(dados),
    onSuccess: (empresa) => { queryClient.setQueryData(chaves.empresa, empresa); },
  });
};
