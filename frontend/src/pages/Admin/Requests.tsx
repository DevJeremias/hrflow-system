import React, { useState } from 'react';
import { CalendarCheck, Check, ChevronDown, X } from 'lucide-react';
import type { EmployeeRequest, RequestStatus } from '../../services/requestService';
import { useDecidirSolicitacao, useSaldoDeFerias, useSolicitacoesDaEmpresa } from '../../queries/solicitacoes';
import AnexoDaSolicitacao from '../../components/AnexoDaSolicitacao';
import ErrorAlert from '../../components/ErrorAlert';
import SaldoDeFerias from '../../components/SaldoDeFerias';
import StatusDaSolicitacao from '../../components/StatusDaSolicitacao';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Field, { Select, Textarea } from '../../components/ui/Field';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toastContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { mensagemDeErro } from '../../utils/erros';
import { formatarDia, rotuloDosDias } from '../../utils/solicitacoes';

const TAMANHO_DA_PAGINA = 50;

const FILTROS: Array<{ valor: RequestStatus | ''; rotulo: string }> = [
  { valor: 'Pendente', rotulo: 'Pendentes' },
  { valor: 'Aprovada', rotulo: 'Aprovadas' },
  { valor: 'Recusada', rotulo: 'Recusadas' },
  { valor: '', rotulo: 'Todas' },
];

// O saldo só é pedido quando o RH o abre: uma página de pedidos não dispara uma consulta por colaborador.
const SaldoDoColaborador: React.FC<{ funcionarioId: number }> = ({ funcionarioId }) => {
  const { data, error, isPending, refetch } = useSaldoDeFerias(funcionarioId);
  if (isPending) return <div className="flex items-center gap-2 text-sm text-ink-muted"><Spinner size="sm" rotulo="Carregando saldo" /> Carregando saldo...</div>;
  if (error) return <ErrorAlert message={mensagemDeErro(error, 'Erro ao calcular o saldo de férias')} onRetry={() => { refetch(); }} />;
  return <SaldoDeFerias saldo={data} compacto />;
};

// Fila de férias e afastamentos da empresa: o RH lê o pedido e o anexo, confere o saldo e o período
// aquisitivo de quem pede férias, e aprova ou recusa (a recusa leva o motivo).
export default function Requests() {
  usePageTitle('Solicitações');
  const toast = useToast();
  const [filtro, setFiltro] = useState<RequestStatus | ''>('Pendente');
  const [pagina, setPagina] = useState(1);
  const [recusando, setRecusando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [erroDaDecisao, setErroDaDecisao] = useState<{ id: number; mensagem: string } | null>(null);
  // O que o RH abriu ou fechou à mão; sem escolha, os pedidos de férias pendentes mostram o saldo e os demais não.
  const [saldoEscolhido, setSaldoEscolhido] = useState<Readonly<Record<number, boolean>>>({});

  const { data, error, isPending, isPlaceholderData, refetch } = useSolicitacoesDaEmpresa({ pagina, limite: TAMANHO_DA_PAGINA, status: filtro || undefined });
  const decidir = useDecidirSolicitacao();
  const decidindo = decidir.isPending ? decidir.variables?.id ?? null : null;

  const itens = data?.requests ?? [];
  const total = data?.total ?? 0;
  const totalDePaginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA));
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar as solicitações') : null;

  const trocarFiltro = (valor: RequestStatus | '') => {
    setFiltro(valor);
    setPagina(1);
    setRecusando(null);
    setErroDaDecisao(null);
  };

  const registrar = async (pedido: EmployeeRequest, status: 'Aprovada' | 'Recusada') => {
    setErroDaDecisao(null);
    try {
      await decidir.mutateAsync({ id: pedido.id, decisao: status === 'Recusada' ? { status, resposta: motivo.trim() } : { status } });
      setRecusando(null);
      setMotivo('');
      toast.success(status === 'Aprovada' ? 'Solicitação aprovada.' : 'Solicitação recusada.');
    } catch (erro) {
      // O erro fica na linha do pedido, junto dos botões que o RH vai tentar de novo.
      setErroDaDecisao({ id: pedido.id, mensagem: mensagemDeErro(erro, 'Não foi possível registrar a decisão.') });
    }
  };

  const abrirRecusa = (id: number) => {
    setRecusando(id);
    setMotivo('');
    setErroDaDecisao(null);
  };

  const saldoVisivel = (pedido: EmployeeRequest) => saldoEscolhido[pedido.id] ?? pedido.status === 'Pendente';
  const alternarSaldo = (pedido: EmployeeRequest) => setSaldoEscolhido((atual) => ({ ...atual, [pedido.id]: !saldoVisivel(pedido) }));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Solicitações"
        description="Férias, licenças e abonos pedidos pelos colaboradores: confira o anexo e o saldo, e aprove ou recuse."
      />

      <Card as="section" padding="none" aria-label="Solicitações da empresa" aria-busy={isPlaceholderData || undefined} className={`overflow-hidden transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
        <div className="flex flex-col items-start justify-between gap-4 border-b border-line bg-surface-muted p-5 md:flex-row md:items-center">
          <Field label="Status" name="status" className="w-full md:w-56">
            <Select value={filtro} onChange={(event) => trocarFiltro(event.target.value as RequestStatus | '')}>
              {FILTROS.map(({ valor, rotulo }) => <option key={rotulo} value={valor}>{rotulo}</option>)}
            </Select>
          </Field>
          <p className="text-sm text-ink-muted">Os pendentes aparecem primeiro, do mais antigo ao mais novo. Dados limitados à empresa da sua sessão.</p>
        </div>

        {isPending ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
            <Spinner size="lg" rotulo="Carregando solicitações" />
            <p className="font-semibold">Carregando solicitações...</p>
          </div>
        ) : loadError ? (
          <div className="p-6"><ErrorAlert message={loadError} onRetry={() => { refetch(); }} /></div>
        ) : itens.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck size={28} />}
            title={filtro === 'Pendente' ? 'Nenhuma solicitação pendente.' : 'Nenhuma solicitação encontrada.'}
          />
        ) : (
          <ul className="divide-y divide-line">
            {itens.map((pedido) => {
              const periodo = `${formatarDia(pedido.startDate)} a ${formatarDia(pedido.endDate)}`;
              const nome = `${pedido.employeeName}, ${pedido.type} de ${periodo}`;
              const mostraSaldo = pedido.type === 'Férias' && saldoVisivel(pedido);
              return (
                <li key={pedido.id} className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 space-y-2">
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-ink">
                        <span>{pedido.employeeName}</span>
                        <Badge tone="brand">{pedido.type}</Badge>
                        <StatusDaSolicitacao status={pedido.status} />
                      </p>
                      <p className="text-sm text-ink">
                        <span className="font-semibold">{periodo}</span>
                        <span className="text-ink-muted"> · {rotuloDosDias(pedido.days)} · pedido em {formatarDia(pedido.requestDate)}</span>
                      </p>
                      <p className="whitespace-pre-wrap break-words text-ink-muted">{pedido.observation}</p>
                      <div className="pt-1"><AnexoDaSolicitacao request={pedido} /></div>
                      {pedido.status !== 'Pendente' && (
                        <p className="text-xs text-ink-muted">
                          {pedido.decidedBy ? `Decidida por ${pedido.decidedBy}` : 'Decidida'}
                          {pedido.reply ? `: ${pedido.reply}` : '.'}
                        </p>
                      )}
                    </div>

                    {pedido.status === 'Pendente' && (
                      pedido.canDecide ? (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button size="sm" onClick={() => registrar(pedido, 'Aprovada')} disabled={decidindo === pedido.id} icon={<Check size={16} aria-hidden="true" />}>
                            Aprovar<span className="sr-only"> solicitação de {nome}</span>
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => abrirRecusa(pedido.id)} disabled={decidindo === pedido.id} icon={<X size={16} aria-hidden="true" />} className="text-danger">
                            Recusar<span className="sr-only"> solicitação de {nome}</span>
                          </Button>
                        </div>
                      ) : (
                        <p className="max-w-xs text-sm text-ink-muted">Você não decide esta solicitação: é a sua, ou de quem tem acesso de RH ou Administrador.</p>
                      )
                    )}
                  </div>

                  {pedido.type === 'Férias' && (
                    <div className="space-y-3">
                      <Button variant="link" size="sm" onClick={() => alternarSaldo(pedido)} aria-expanded={mostraSaldo} className="gap-1 text-sm">
                        Saldo e período aquisitivo<span className="sr-only"> de {pedido.employeeName}</span>
                        <ChevronDown size={16} aria-hidden="true" className={mostraSaldo ? 'rotate-180' : ''} />
                      </Button>
                      {mostraSaldo && <SaldoDoColaborador funcionarioId={pedido.employeeId} />}
                    </div>
                  )}

                  {recusando === pedido.id && (
                    <div className="space-y-3 rounded-card border border-danger-line bg-danger-soft p-4">
                      <Field label="Motivo da recusa" name="motivo" required>
                        <Textarea
                          autoFocus
                          value={motivo}
                          onChange={(event) => setMotivo(event.target.value)}
                          maxLength={500}
                          rows={3}
                          placeholder="O colaborador vai ler este texto na lista de solicitações dele."
                        />
                      </Field>
                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" onClick={() => registrar(pedido, 'Recusada')} disabled={!motivo.trim()} loading={decidindo === pedido.id}>Confirmar recusa</Button>
                        <Button variant="secondary" size="sm" onClick={() => setRecusando(null)}>Cancelar</Button>
                      </div>
                    </div>
                  )}

                  {erroDaDecisao?.id === pedido.id && <ErrorAlert message={erroDaDecisao.mensagem} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {!isPending && !loadError && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <span>Página {pagina} de {totalDePaginas} · {total} {total === 1 ? 'solicitação' : 'solicitações'}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPagina((atual) => atual - 1)} disabled={pagina <= 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => setPagina((atual) => atual + 1)} disabled={pagina >= totalDePaginas}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
