import React, { useEffect, useState } from 'react';
import { Clock, Search, Calendar as CalendarIcon, Users } from 'lucide-react';
import { pontoService, type CompanyPointRecord } from '../../services/pontoService';
import ErrorAlert from '../../components/ErrorAlert';
import JustificativasPonto from '../../components/Admin/JustificativasPonto';
import { mensagemDeErro } from '../../utils/erros';
import { formatarDataIso, formatarHoraSemSegundos } from '../../utils/ponto';
import { mesAtualEmBelem } from '../../utils/competencia';

const TAMANHO_DA_PAGINA = 50;
const ATRASO_DA_BUSCA_MS = 300;

type Aba = 'marcacoes' | 'justificativas';

const ABAS: Array<{ id: Aba; rotulo: string }> = [
  { id: 'marcacoes', rotulo: 'Marcações' },
  { id: 'justificativas', rotulo: 'Justificativas' },
];

interface Resultado {
  chave: string;
  registros: CompanyPointRecord[];
  total: number;
  erro: string | null;
}

export default function TimeTracking() {
  const [aba, setAba] = useState<Aba>('marcacoes');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [busca, setBusca] = useState('');
  const [monthFilter, setMonthFilter] = useState(mesAtualEmBelem);
  const [pagina, setPagina] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const termo = searchTerm.trim();
    if (termo === busca) return undefined;
    const timer = setTimeout(() => {
      setBusca(termo);
      setPagina(1);
    }, ATRASO_DA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [searchTerm, busca]);

  const chave = `${monthFilter}|${busca}|${pagina}|${reloadKey}`;

  useEffect(() => {
    let ativo = true;
    const pronto = (parcial: Omit<Resultado, 'chave'>) => { if (ativo) setResultado({ chave, ...parcial }); };
    pontoService.getRegistrosDaEmpresa({ mes: monthFilter, pagina, limite: TAMANHO_DA_PAGINA, busca })
      .then((dados) => pronto({ ...dados, erro: null }))
      .catch((error) => pronto({ registros: [], total: 0, erro: mensagemDeErro(error, 'Erro ao buscar os registros de ponto') }));
    return () => { ativo = false; };
  }, [chave, monthFilter, pagina, busca]);

  const loading = resultado?.chave !== chave;
  const loadError = loading ? null : resultado.erro;
  const registros = loading ? [] : resultado.registros;
  const total = loading ? 0 : resultado.total;
  const totalDePaginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA));

  const colaboradores = new Set(registros.map((registro) => registro.funcionario_id)).size;
  const diasMonitorados = new Set(registros.map((registro) => registro.date)).size;
  const retry = () => setReloadKey((key) => key + 1);
  const trocarMes = (mes: string) => {
    setMonthFilter(mes);
    setPagina(1);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Ponto</h1>
          <p className="text-slate-500 font-medium mt-1">Consulte as marcações de ponto dos colaboradores e decida as justificativas.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold shadow-sm">
            <CalendarIcon size={18} />
            <span className="sr-only">Mês de referência</span>
            <input aria-label="Mês de referência" type="month" value={monthFilter} onChange={(event) => event.target.value && trocarMes(event.target.value)} className="bg-transparent outline-none" />
          </label>
        </div>
      </div>

      <div role="tablist" aria-label="Seções da gestão de ponto" className="flex gap-2 border-b border-slate-200">
        {ABAS.map(({ id, rotulo }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`aba-${id}`}
            aria-selected={aba === id}
            aria-controls={`painel-${id}`}
            onClick={() => setAba(id)}
            className={`-mb-px border-b-2 px-5 py-3 font-bold transition-colors ${aba === id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >{rotulo}</button>
        ))}
      </div>

      {aba === 'justificativas' ? (
        <div role="tabpanel" id="painel-justificativas" aria-labelledby="aba-justificativas">
          <JustificativasPonto mes={monthFilter} />
        </div>
      ) : (
        <div role="tabpanel" id="painel-marcacoes" aria-labelledby="aba-marcacoes" className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard label="Marcações no mês" value={loading || loadError ? '—' : total} icon={<Clock size={28} />} color="indigo" />
          <SummaryCard label="Colaboradores nesta página" value={loading || loadError ? '—' : colaboradores} icon={<Users size={28} />} color="emerald" />
          <SummaryCard label="Dias nesta página" value={loading || loadError ? '—' : diasMonitorados} icon={<CalendarIcon size={28} />} color="rose" />
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="search"
                placeholder="Buscar colaborador..."
                aria-label="Buscar colaborador"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <p className="text-sm font-medium text-slate-500">Dados limitados à empresa da sua sessão.</p>
          </div>

          {loading ? (
            <div role="status" className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
              <p className="font-bold">Carregando registros de ponto...</p>
            </div>
          ) : loadError ? (
            <div className="p-6"><ErrorAlert message={loadError} onRetry={retry} /></div>
          ) : total === 0 ? (
            <p className="py-16 text-center font-medium text-slate-500">Nenhum registro de ponto encontrado neste mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase tracking-wider font-bold">
                    <th className="p-5">Colaborador</th>
                    <th className="p-5">Data</th>
                    <th className="p-5">Marcação</th>
                    <th className="p-5">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registros.map((registro) => (
                    <tr key={registro.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5 font-bold text-slate-800">{registro.nome_funcionario}</td>
                      <td className="p-5 font-medium text-slate-600">{formatarDataIso(registro.date)}</td>
                      <td className="p-5 font-medium text-slate-600">{registro.tipo_registro}</td>
                      <td className="p-5 font-bold text-slate-700">{formatarHoraSemSegundos(registro.time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && !loadError && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
            <span>Página {pagina} de {totalDePaginas} · {total} marcações</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPagina((atual) => atual - 1)}
                disabled={pagina <= 1}
                className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >Anterior</button>
              <button
                type="button"
                onClick={() => setPagina((atual) => atual + 1)}
                disabled={pagina >= totalDePaginas}
                className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >Próxima</button>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'rose';
}

function SummaryCard({ label, value, icon, color }: SummaryCardProps) {
  const styles = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600'
  };
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${styles[color]}`}>{icon}</div>
      <div>
        <p className="text-slate-500 font-bold text-sm">{label}</p>
        <h3 className="text-2xl font-black text-slate-800">{value}</h3>
      </div>
    </div>
  );
}
