// Como os pedidos de alteração cadastral aparecem na tela: o nome de cada campo e de cada situação.
import type { CampoDoPedidoApi, StatusDoPedidoApi } from '../types/api.ts';

export const ROTULO_DO_CAMPO: Record<CampoDoPedidoApi, string> = {
  nome: 'Nome', email: 'E-mail de acesso', endereco: 'Endereço', banco: 'Banco', agencia: 'Agência', conta: 'Conta', tipo_conta: 'Tipo de conta',
};

export const CAMPOS_DO_PEDIDO = Object.keys(ROTULO_DO_CAMPO) as CampoDoPedidoApi[];

export const ROTULO_DO_STATUS: Record<StatusDoPedidoApi, string> = {
  pendente: 'Aguardando decisão', aprovada: 'Aprovada', recusada: 'Recusada', cancelada: 'Substituída por um pedido mais novo',
};

// Os tons de Badge (components/ui/Badge.tsx).
export const TOM_DO_STATUS: Record<StatusDoPedidoApi, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pendente: 'warning', aprovada: 'success', recusada: 'danger', cancelada: 'neutral',
};
