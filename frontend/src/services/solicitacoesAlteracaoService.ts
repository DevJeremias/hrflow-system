import httpClient from './httpClient.ts';
import type {
  CorpoDeDecisaoDoPedidoApi, CorpoDeSolicitacaoApi, SolicitacaoDeAlteracaoApi, StatusDoPedidoApi,
} from '../types/api.ts';

// Pedidos de alteração cadastral (nome, e-mail, endereço e dados bancários), aprovados por quem gere o cadastro.
// Não confundir com as solicitações de férias e licenças (requestService), que ainda não têm backend.
export type PedidoDeAlteracao = SolicitacaoDeAlteracaoApi;
export type NovoPedidoDeAlteracao = CorpoDeSolicitacaoApi;

const API_URL = '/solicitacoes-alteracao';

export interface PaginaDePedidos {
  pedidos: PedidoDeAlteracao[];
  total: number;
}

export const solicitacoesAlteracaoService = {
  // Os pedidos da empresa que a pessoa pode decidir, do mais novo ao mais antigo.
  getPage: async (status: StatusDoPedidoApi | null, pagina: number, limite: number): Promise<PaginaDePedidos> => {
    const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite), ...(status ? { status } : {}) });
    let total = 0;
    const pedidos = await httpClient<PedidoDeAlteracao[]>(`${API_URL}?${params}`, {
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao buscar as solicitações',
      onResponse: (response) => {
        const header = response.headers.get('X-Total-Count');
        if (header === null || !/^\d+$/.test(header)) throw new Error('Resposta da API sem total válido de solicitações');
        total = Number(header);
      },
    });
    return { pedidos, total };
  },

  getMine: (): Promise<PedidoDeAlteracao[]> =>
    httpClient<PedidoDeAlteracao[]>(`${API_URL}/minhas`, { auth: true, errorMessage: (err) => err?.erro || 'Erro ao buscar as suas solicitações' }),

  create: (pedido: NovoPedidoDeAlteracao): Promise<PedidoDeAlteracao> =>
    httpClient<PedidoDeAlteracao>(API_URL, {
      method: 'POST',
      auth: true,
      body: JSON.stringify(pedido),
      errorMessage: (err) => err?.erro || 'Erro ao enviar a solicitação',
    }),

  decide: (id: number, decisao: CorpoDeDecisaoDoPedidoApi): Promise<PedidoDeAlteracao> =>
    httpClient<PedidoDeAlteracao>(`${API_URL}/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(decisao),
      errorMessage: (err) => err?.erro || 'Erro ao registrar a decisão',
    }),
};
