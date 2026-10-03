import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { pontoService, type Justification, type JustificationStatus } from '../../services/pontoService';
import ErrorAlert from '../ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { ROTULO_DA_JUSTIFICATIVA, formatarDataIso } from '../../utils/ponto';

const FILTROS: Array<{ valor: JustificationStatus | ''; rotulo: string }> = [
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'aprovada', rotulo: 'Aprovadas' },
  { valor: 'recusada', rotulo: 'Recusadas' },
  { valor: '', rotulo: 'Todas' },
];

const CLASSE_DO_STATUS: Record<JustificationStatus, string> = {
  pendente: 'bg-amber-50 text-amber-600',
  aprovada: 'bg-emerald-50 text-emerald-600',
  recusada: 'bg-rose-50 text-rose-600',
};

interface Resultado {
  chave: string;
  itens: Justification[];
  erro: string | null;
}

// Fila de justificativas do mês: o RH lê o texto do colaborador e aprova ou recusa (a recusa leva o motivo).
export default function JustificativasPonto({ mes }: { mes: string }) {
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
    } catch (error) {
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
    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50/50">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-600">
          Status
          <select
            aria-label="Filtrar justificativas por status"
            value={filtro}
            onChange={(event) => trocarFiltro(event.target.value as JustificationStatus | '')}
            className="bg-white border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-bold outline-none focus:border-primary"
          >
            {FILTROS.map(({ valor, rotulo }) => <option key={rotulo} value={valor}>{rotulo}</option>)}
          </select>
        </label>
        <p className="text-sm font-medium text-slate-500">Justificativas dos dias do mês selecionado, enviadas pelos colaboradores.</p>
      </div>

      {loading ? (
        <div role="status" className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          <p className="font-bold">Carregando justificativas...</p>
        </div>
      ) : loadError ? (
        <div className="p-6"><ErrorAlert message={loadError} onRetry={() => setReloadKey((key) => key + 1)} /></div>
      ) : itens.length === 0 ? (
        <p className="py-16 text-center font-medium text-slate-500">
          {filtro === 'pendente' ? 'Nenhuma justificativa pendente neste mês.' : 'Nenhuma justificativa encontrada neste mês.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {itens.map((item) => (
            <li key={item.id} className="p-4 sm:p-6 space-y-3">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-slate-800">
                    <span>{item.nome_funcionario}</span>
                    <span className="font-medium text-slate-500">{formatarDataIso(item.date)}</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${CLASSE_DO_STATUS[item.status]}`}>{ROTULO_DA_JUSTIFICATIVA[item.status]}</span>
                  </p>
                  <p className="text-slate-600 font-medium whitespace-pre-wrap break-words">{item.note}</p>
                  {item.status !== 'pendente' && (
                    <p className="text-xs font-bold text-slate-400">
                      {item.decidedBy ? `Decidida por ${item.decidedBy}` : 'Decidida'}
                      {item.reply ? `: ${item.reply}` : '.'}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {item.status !== 'aprovada' && (
                    <button
                      type="button"
                      onClick={() => decidir(item, 'aprovada')}
                      disabled={decidindo === item.id}
                      aria-label={`Aprovar justificativa de ${item.nome_funcionario} em ${formatarDataIso(item.date)}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    ><Check size={16} /> Aprovar</button>
                  )}
                  {item.status !== 'recusada' && (
                    <button
                      type="button"
                      onClick={() => abrirRecusa(item.id)}
                      disabled={decidindo === item.id}
                      aria-label={`Recusar justificativa de ${item.nome_funcionario} em ${formatarDataIso(item.date)}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    ><X size={16} /> Recusar</button>
                  )}
                </div>
              </div>

              {recusando === item.id && (
                <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                  <label className="block text-sm font-bold text-slate-700">
                    Motivo da recusa
                    <textarea
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="O colaborador vai ler este texto no espelho de ponto."
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decidir(item, 'recusada')}
                      disabled={decidindo === item.id || !motivo.trim()}
                      className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >Confirmar recusa</button>
                    <button type="button" onClick={() => setRecusando(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
                  </div>
                </div>
              )}

              {erroDaDecisao?.id === item.id && (
                <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-600">{erroDaDecisao.mensagem}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
