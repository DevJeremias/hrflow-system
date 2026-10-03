import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService, type CompanyRequestQuery, type NewRequest, type RequestDecision } from '../services/requestService';
import { chaves } from './chaves';

export const useMinhasSolicitacoes = () => useQuery({
  queryKey: chaves.minhasSolicitacoes,
  queryFn: requestService.getMyRequests,
});

// A fila do RH: mantém a página anterior na tela enquanto a nova chega.
export const useSolicitacoesDaEmpresa = (consulta: CompanyRequestQuery) => useQuery({
  queryKey: chaves.solicitacoesDaEmpresa(consulta),
  queryFn: () => requestService.getAllRequests(consulta),
  placeholderData: keepPreviousData,
});

// Sem vínculo com um colaborador não há saldo a consultar; `habilitado` deixa a consulta esperar a tela pedi-lo.
export const useSaldoDeFerias = (funcionarioId: number | null, habilitado = true) => useQuery({
  queryKey: chaves.saldoDeFerias(funcionarioId ?? 0),
  queryFn: () => requestService.getBalance(funcionarioId as number),
  enabled: funcionarioId !== null && habilitado,
});

// Um pedido novo muda a lista do colaborador, a fila do RH e o saldo (os dias em análise saem dele).
export const useCriarSolicitacao = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pedido: NewRequest) => requestService.createRequest(pedido),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.solicitacoes }),
  });
};

// A decisão muda a fila, o saldo e, quando o período vale hoje, a situação do colaborador na lista.
export const useDecidirSolicitacao = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisao }: { id: number; decisao: RequestDecision }) => requestService.decideRequest(id, decisao),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.solicitacoes }),
      queryClient.invalidateQueries({ queryKey: chaves.funcionarios }),
    ]),
  });
};
