import React from 'react';
import { Check, X } from 'lucide-react';
import type { PedidoDeAlteracao } from '../../services/solicitacoesAlteracaoService';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatarMomento } from '../../utils/competencia';
import { CAMPOS_DO_PEDIDO, ROTULO_DO_CAMPO, ROTULO_DO_STATUS, TOM_DO_STATUS } from '../../utils/pedidosDeAlteracao';

// O que o pedido muda, campo a campo: o valor de antes riscado e o novo em destaque.
export const MudancasDoPedido: React.FC<{ pedido: PedidoDeAlteracao }> = ({ pedido }) => (
  <dl className="space-y-2 text-sm">
    {CAMPOS_DO_PEDIDO.filter((campo) => campo in pedido.alteracoes).map((campo) => (
      <div key={campo} className="grid grid-cols-[7.5rem_1fr] gap-x-3 sm:grid-cols-[9rem_1fr]">
        <dt className="font-semibold text-ink-muted">{ROTULO_DO_CAMPO[campo]}</dt>
        <dd className="min-w-0 break-words text-ink">
          <span className="text-ink-muted line-through decoration-ink-subtle">{pedido.anteriores[campo] || 'vazio'}</span>
          <span aria-hidden="true"> → </span>
          <span className="sr-only"> para </span>
          <span className="font-semibold">{pedido.alteracoes[campo] || 'vazio'}</span>
        </dd>
      </div>
    ))}
  </dl>
);

interface Props {
  pedido: PedidoDeAlteracao;
  // Sem estas funções o cartão só mostra o pedido (histórico das decisões).
  onAprovar?: (pedido: PedidoDeAlteracao) => void;
  onRecusar?: (pedido: PedidoDeAlteracao) => void;
  ocupado?: boolean;
}

const PedidoDeAlteracaoCard: React.FC<Props> = ({ pedido, onAprovar, onRecusar, ocupado = false }) => (
  <Card as="article" aria-label={`Pedido de ${pedido.solicitante.nome}`} className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-bold text-ink">{pedido.solicitante.nome}</h3>
        <p className="text-xs text-ink-muted">
          {pedido.solicitante.perfil} · pedido em <time dateTime={pedido.criado_em}>{formatarMomento(pedido.criado_em)}</time>
        </p>
      </div>
      <Badge tone={TOM_DO_STATUS[pedido.status]}>{ROTULO_DO_STATUS[pedido.status]}</Badge>
    </div>

    <MudancasDoPedido pedido={pedido} />

    {pedido.decidido_em && (
      <p className="text-xs text-ink-muted">
        {pedido.status === 'aprovada' ? 'Aprovada' : 'Recusada'} por {pedido.decidido_por ?? 'conta removida'} em {formatarMomento(pedido.decidido_em)}
        {pedido.resposta ? `: "${pedido.resposta}"` : '.'}
      </p>
    )}

    {pedido.status === 'pendente' && onAprovar && onRecusar && (
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => onRecusar(pedido)} disabled={ocupado} icon={<X size={18} aria-hidden="true" />}>
          Recusar<span className="sr-only"> o pedido de {pedido.solicitante.nome}</span>
        </Button>
        <Button onClick={() => onAprovar(pedido)} disabled={ocupado} icon={<Check size={18} aria-hidden="true" />}>
          Aprovar<span className="sr-only"> o pedido de {pedido.solicitante.nome}</span>
        </Button>
      </div>
    )}
  </Card>
);

export default PedidoDeAlteracaoCard;
