import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { solicitacoesAlteracaoService, type NovoPedidoDeAlteracao } from '../services/solicitacoesAlteracaoService';
import type { CorpoDeDecisaoDoPedidoApi, StatusDoPedidoApi } from '../types/api';
import { chaves } from './chaves';

export const usePedidosDaEmpresa = (status: StatusDoPedidoApi | null, pagina: number, limite: number) => useQuery({
  queryKey: chaves.paginaDePedidos(status, pagina, limite),
  queryFn: () => solicitacoesAlteracaoService.getPage(status, pagina, limite),
  placeholderData: keepPreviousData,
});

export const useMeusPedidos = () => useQuery({ queryKey: chaves.meusPedidos, queryFn: solicitacoesAlteracaoService.getMine });

// Pedir muda a lista da própria pessoa; decidir muda a da empresa e, se aprovado, o cadastro, a lista de
// colaboradores, o perfil e a trilha.
export const useEnviarPedido = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pedido: NovoPedidoDeAlteracao) => solicitacoesAlteracaoService.create(pedido),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.pedidos }),
  });
};

export const useDecidirPedido = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisao }: { id: number; decisao: CorpoDeDecisaoDoPedidoApi }) => solicitacoesAlteracaoService.decide(id, decisao),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.pedidos }),
      queryClient.invalidateQueries({ queryKey: chaves.funcionarios }),
      queryClient.invalidateQueries({ queryKey: chaves.auditoria }),
    ]),
  });
};
