import React from 'react';
import { useMeusPedidos } from '../../queries/solicitacoesAlteracao';
import { MudancasDoPedido } from '../Admin/PedidoDeAlteracaoCard';
import Badge from '../ui/Badge';
import { formatarMomento } from '../../utils/competencia';
import { ROTULO_DO_STATUS, TOM_DO_STATUS } from '../../utils/pedidosDeAlteracao';

// Os pedidos de alteração que a pessoa fez e o que aconteceu com eles. O pedido pendente avisa que os dados
// atuais continuam valendo até a decisão; o recusado mostra a resposta de quem decidiu. Não aparece nada
// enquanto ela nunca pediu (ou só tem pedidos substituídos).
const MeusPedidos: React.FC = () => {
  const { data } = useMeusPedidos();
  const pedidos = (data ?? []).filter((pedido) => pedido.status !== 'cancelada').slice(0, 3);
  if (pedidos.length === 0) return null;

  return (
    <section aria-labelledby="meus-pedidos-titulo" className="space-y-3">
      <h2 id="meus-pedidos-titulo" className="text-lg font-bold text-ink">Seus pedidos de alteração</h2>
      <ul className="space-y-3">
        {pedidos.map((pedido) => (
          <li key={pedido.id} className="space-y-3 rounded-card border border-line bg-surface-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-muted">Enviado em <time dateTime={pedido.criado_em}>{formatarMomento(pedido.criado_em)}</time></span>
              <Badge tone={TOM_DO_STATUS[pedido.status]}>{ROTULO_DO_STATUS[pedido.status]}</Badge>
            </div>
            <MudancasDoPedido pedido={pedido} />
            {pedido.status === 'pendente' && (
              <p className="text-xs text-ink-muted">Os dados atuais continuam valendo até a decisão.</p>
            )}
            {pedido.status === 'recusada' && (
              <p className="text-sm text-ink">
                <strong>Recusado{pedido.decidido_por ? ` por ${pedido.decidido_por}` : ''}:</strong> {pedido.resposta || 'sem motivo informado.'}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MeusPedidos;
