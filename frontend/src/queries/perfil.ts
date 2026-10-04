import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import type { CorpoDeMeusDadosApi } from '../types/api';
import { chaves } from './chaves';

export const useMeuPerfil = () => useQuery({ queryKey: chaves.perfil, queryFn: userService.getMyProfile });

// O nome (que o Administrador grava direto) aparece nas marcações e na listagem de colaboradores.
export const useAtualizarMeuPerfil = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: CorpoDeMeusDadosApi) => userService.updateMyProfile(dados),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.perfil }),
      queryClient.invalidateQueries({ queryKey: chaves.funcionarios }),
      queryClient.invalidateQueries({ queryKey: chaves.ponto }),
    ]),
  });
};
