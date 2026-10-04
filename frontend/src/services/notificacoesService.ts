import httpClient from './httpClient.ts';
import type { ListaDeNotificacoesApi, NotificacaoApi } from '../types/api.ts';

export type Notification = NotificacaoApi;
export type NotificationList = ListaDeNotificacoesApi;

const API_URL = '/notificacoes';

export const notificacoesService = {
  async list(limite = 20): Promise<NotificationList> {
    const dados = await httpClient<NotificationList>(`${API_URL}?limite=${limite}`, { auth: true, errorMessage: 'Erro ao carregar as notificações' });
    if (!dados || !Array.isArray(dados.itens) || !Number.isInteger(dados.naoLidas)) throw new Error('Resposta inválida ao carregar as notificações');
    return dados;
  },

  markRead: (id: number) =>
    httpClient<{ naoLidas: number }>(`${API_URL}/${id}/lida`, { method: 'POST', auth: true, errorMessage: 'Erro ao marcar a notificação como lida' }),

  markAllRead: () =>
    httpClient<{ naoLidas: number }>(`${API_URL}/lidas`, { method: 'POST', auth: true, errorMessage: 'Erro ao marcar as notificações como lidas' }),
};
