import React, { useEffect, useState } from 'react';
import { Check, MessageSquareText, X } from 'lucide-react';
import { pontoService, type Justification, type JustificationStatus } from '../../services/pontoService';
import ErrorAlert from '../ErrorAlert';
import Badge, { type BadgeTone } from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import Field, { Select, Textarea } from '../ui/Field';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';
import { ROTULO_DA_JUSTIFICATIVA, formatarDataIso } from '../../utils/ponto';

const FILTROS: Array<{ valor: JustificationStatus | ''; rotulo: string }> = [
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'aprovada', rotulo: 'Aprovadas' },
  { valor: 'recusada', rotulo: 'Recusadas' },
  { valor: '', rotulo: 'Todas' },
];

const TOM_DO_STATUS: Record<JustificationStatus, BadgeTone> = {
  pendente: 'warning',
  aprovada: 'success',
  recusada: 'danger',
};

interface Resultado {
  chave: string;
  itens: Justification[];
  erro: string | null;
}

// Fila de justificativas do mês: o RH lê o texto do colaborador e aprova ou recusa (a recusa leva o motivo).
export default function JustificativasPonto({ mes }: { mes: string }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState<JustificationStatus | ''>('pendente');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [recusando, setRecusando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [decidindo, setDecidindo] = useState<number | null>(null);
  const [erroDaDecisao, setErroDaDecisao] = useState<{ id: number; mensagem: string } | null>(null);

  const chave = `${mes}|${filtro}|${reloadKey}`;

  useEffect(() => {
    let ativo = true;
    const pronto = (parcial: Omit<Resultado, 'chave'>) => { if (ativo) setResultado({ chave, ...parcial }); };
    pontoService.getJustificativas(mes, filtro || undefined)
      .then((itens) => pronto({ itens, erro: null }))
      .catch((error) => pronto({ itens: [], erro: mensagemDeErro(error, 'Erro ao buscar as justificativas') }));
    return () => { ativo = false; };
  }, [chave, mes, filtro]);

  const loading = resultado?.chave !== chave;
  const loadError = loading ? null : resultado.erro;
  const itens = loading ? [] : resultado.itens;

  const trocarFiltro = (valor: JustificationStatus | '') => {
    setFiltro(valor);
    setRecusando(null);
    setErroDaDecisao(null);
  };

  const decidir = async (justificativa: Justification, status: 'aprovada' | 'recusada') => {
    setDecidindo(justificativa.id);
    setErroDaDecisao(null);
    try {
      await pontoService.decidirJustificativa(justificativa.id, status === 'recusada' ? { status, resposta: motivo.trim() } : { status });
      setRecusando(null);
      setMotivo('');
      setReloadKey((key) => key + 1);
      toast.success(status === 'aprovada' ? 'Justificativa aprovada.' : 'Justificativa recusada.');
    } catch (error) {
      // O erro fica na linha da justificativa, junto dos botões que o RH vai tentar de novo.
      setErroDaDecisao({ id: justificativa.id, mensagem: mensagemDeErro(error, 'Não foi possível registrar a decisão.') });
    } finally {
      setDecidindo(null);
    }
  };

  const abrirRecusa = (id: number) => {
    setRecusando(id);
    setMotivo('');
    setErroDaDecisao(null);
  };

  return (
    <Card as="section" padding="none" className="overflow-hidden" aria-label="Justificativas de ponto">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-line bg-surface-muted p-5 md:flex-row md:items-center">
        <Field label="Status" name="status" className="w-full md:w-56">
          <Select value={filtro} onChange={(event) => trocarFiltro(event.target.value as JustificationStatus | '')}>
            {FILTROS.map(({ valor, rotulo }) => <option key={rotulo} value={valor}>{rotulo}</option>)}
          </Select>
        </Field>
        <p className="text-sm text-ink-muted">Justificativas dos dias do mês selecionado, enviadas pelos colaboradores.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
          <Spinner size="lg" rotulo="Carregando justificativas" />
          <p className="font-semibold">Carregando justificativas...</p>
        </div>
      ) : loadError ? (
        <div className="p-6"><ErrorAlert message={loadError} onRetry={() => setReloadKey((key) => key + 1)} /></div>
      ) : itens.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText size={28} />}
          title={filtro === 'pendente' ? 'Nenhuma justificativa pendente neste mês.' : 'Nenhuma justificativa encontrada neste mês.'}
        />
      ) : (
        <ul className="divide-y divide-line">
          {itens.map((item) => {
            const data = formatarDataIso(item.date);
            return (
              <li key={item.id} className="space-y-3 p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-ink">
                      <span>{item.nome_funcionario}</span>
                      <span className="font-normal text-ink-muted">{data}</span>
                      <Badge tone={TOM_DO_STATUS[item.status]}>{ROTULO_DA_JUSTIFICATIVA[item.status]}</Badge>
                    </p>
                    <p className="whitespace-pre-wrap break-words text-ink-muted">{item.note}</p>
                    {item.status !== 'pendente' && (
                      <p className="text-xs text-ink-muted">
                        {item.decidedBy ? `Decidida por ${item.decidedBy}` : 'Decidida'}
                        {item.reply ? `: ${item.reply}` : '.'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.status !== 'aprovada' && (
                      <Button size="sm" onClick={() => decidir(item, 'aprovada')} disabled={decidindo === item.id} icon={<Check size={16} aria-hidden="true" />}>
                        Aprovar<span className="sr-only"> justificativa de {item.nome_funcionario} em {data}</span>
                      </Button>
                    )}
                    {item.status !== 'recusada' && (
                      <Button variant="secondary" size="sm" onClick={() => abrirRecusa(item.id)} disabled={decidindo === item.id} icon={<X size={16} aria-hidden="true" />} className="text-danger">
                        Recusar<span className="sr-only"> justificativa de {item.nome_funcionario} em {data}</span>
                      </Button>
                    )}
                  </div>
                </div>

                {recusando === item.id && (
                  <div className="space-y-3 rounded-card border border-danger-line bg-danger-soft p-4">
                    <Field label="Motivo da recusa" name="motivo" required>
                      <Textarea
                        autoFocus
                        value={motivo}
                        onChange={(event) => setMotivo(event.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="O colaborador vai ler este texto no espelho de ponto."
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={() => decidir(item, 'recusada')} disabled={!motivo.trim()} loading={decidindo === item.id}>Confirmar recusa</Button>
                      <Button variant="secondary" size="sm" onClick={() => setRecusando(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {erroDaDecisao?.id === item.id && <ErrorAlert message={erroDaDecisao.mensagem} />}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
