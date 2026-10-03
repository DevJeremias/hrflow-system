import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersService, type NewUser, type UserChange } from '../services/usersService';
import { chaves } from './chaves';

export const useUsuarios = (pagina: number, limite: number) => useQuery({
  queryKey: chaves.paginaDeUsuarios(pagina, limite),
  queryFn: () => usersService.getPage(pagina, limite),
  placeholderData: keepPreviousData,
});

// Criar, trocar o perfil e redefinir a senha mudam a lista de acessos.
const useInvalidarUsuarios = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: chaves.usuarios });
};

export const useCriarUsuario = () => {
  const invalidar = useInvalidarUsuarios();
  return useMutation({ mutationFn: (novo: NewUser) => usersService.create(novo), onSuccess: invalidar });
};

export const useAlterarUsuario = () => {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: ({ id, mudanca }: { id: number; mudanca: UserChange }) => usersService.update(id, mudanca),
    onSuccess: invalidar,
  });
};
