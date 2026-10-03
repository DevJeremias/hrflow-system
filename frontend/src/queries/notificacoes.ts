import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificacoesService, type NotificationList } from '../services/notificacoesService';
import { chaves } from './chaves';

// O sino confere os avisos de tempos em tempos e ao voltar para a aba: quem o RH avisou não precisa recarregar.
const INTERVALO_DO_SINO_MS = 60_000;

export const useNotificacoes = () => useQuery({
  queryKey: chaves.notificacoes,
  queryFn: () => notificacoesService.list(),
  refetchInterval: INTERVALO_DO_SINO_MS,
  refetchOnWindowFocus: true,
});

// Marcar como lida muda a lista na hora, com a contagem que o servidor devolveu, sem esperar a conferência seguinte.
const aplicarLeitura = (lista: NotificationList | undefined, naoLidas: number, ids: number[] | 'todas'): NotificationList | undefined =>
  lista && { naoLidas, itens: lista.itens.map((aviso) => (ids === 'todas' || ids.includes(aviso.id) ? { ...aviso, lida: true } : aviso)) };

export const useMarcarNotificacaoLida = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificacoesService.markRead(id),
    onSuccess: ({ naoLidas }, id) => { queryClient.setQueryData<NotificationList>(chaves.notificacoes, (lista) => aplicarLeitura(lista, naoLidas, [id])); },
  });
};

export const useMarcarTodasLidas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificacoesService.markAllRead(),
    onSuccess: ({ naoLidas }) => { queryClient.setQueryData<NotificationList>(chaves.notificacoes, (lista) => aplicarLeitura(lista, naoLidas, 'todas')); },
  });
};
