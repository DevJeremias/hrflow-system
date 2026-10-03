import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Filter, CalendarDays, Lock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getPayroll, processPayroll, closePayroll, MonthlyPayroll } from '../../services/payrollService';
import PayrollSummaryCards from '../../components/Admin/PayrollMetrics';
import PayrollTable from '../../components/Admin/PayrollTable';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { mesAtualEmBelem, rotuloDaCompetencia, formatarMomento } from '../../utils/competencia';

type Acao = 'processar' | 'fechar';

const Payroll: React.FC = () => {
  const [competencia, setCompetencia] = useState(mesAtualEmBelem);
  const [folha, setFolha] = useState<MonthlyPayroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);
  const [deptFilter, setDeptFilter] = useState('Todos');
  const [reloadKey, setReloadKey] = useState(0);
  // Uma resposta que chega depois de o RH trocar o mês não pode sobrescrever a folha do mês novo.
  const competenciaDaTela = useRef(competencia);

  const trocarCompetencia = (nova: string) => {
    competenciaDaTela.current = nova;
    setCompetencia(nova);
    setFolha(null);
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setConfirmandoFechamento(false);
    setDeptFilter('Todos');
  };

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let ativo = true;
    getPayroll(competencia)
      .then((dados) => { if (ativo) setFolha(dados); })
      .catch((error) => { if (ativo) { setFolha(null); setLoadError(mensagemDeErro(error, 'Erro ao buscar a folha de pagamento')); } })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [competencia, reloadKey]);

  const executar = async (qual: Acao, operacao: (mes: string) => Promise<MonthlyPayroll>) => {
    const mes = competencia;
    setAcao(qual);
    setActionError(null);
    try {
      const resultado = await operacao(mes);
      if (competenciaDaTela.current === mes) {
        setFolha(resultado);
        setConfirmandoFechamento(false);
      }
    } catch (error) {
      if (competenciaDaTela.current === mes) setActionError(mensagemDeErro(error, 'Não foi possível concluir a operação.'));
    } finally {
      setAcao(null);
    }
  };

  const itens = folha?.itens;
  const displayedPayrolls = useMemo(() => {
    if (!itens) return [];
    return deptFilter === 'Todos' ? itens : itens.filter(p => p.department === deptFilter);
  }, [itens, deptFilter]);

  const dynamicMetrics = useMemo(() => {
    return displayedPayrolls.reduce((acc, curr) => ({
      gross: acc.gross + curr.totalGross,
      deductions: acc.deductions + curr.totalDeductions,
      net: acc.net + curr.netSalary,
      charges: acc.charges + curr.employerCharges
    }), { gross: 0, deductions: 0, net: 0, charges: 0 });
  }, [displayedPayrolls]);

  const departmentsList = Array.from(new Set((itens ?? []).map(p => p.department)));
  const rotulo = rotuloDaCompetencia(competencia);
  const fechada = folha?.status === 'fechada';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Cabeçalho com a competência e os filtros */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Folha</h1>
          <p className="text-slate-500 font-medium mt-1">{fechada ? `Folha de ${rotulo}, fechada.` : `Folha de ${rotulo}: confira os holerites e feche o mês.`}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex w-full sm:w-auto items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
            <CalendarDays size={16} className="shrink-0 text-slate-400" />
            <span className="sr-only">Competência</span>
            <input aria-label="Competência" type="month" value={competencia} max={mesAtualEmBelem()} onChange={(e) => e.target.value && trocarCompetencia(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer" />
          </label>
          {folha && (
            <div className="flex w-full sm:w-auto items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <Filter size={16} className="shrink-0 text-slate-400" />
              <select aria-label="Setor" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="min-w-0 flex-1 bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer">
                <option value="Todos">Todos os Setores</option>
                {departmentsList.map(dept => <option key={dept} value={dept}>{dept}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div role="status" className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold">Carregando a folha...</p>
        </div>
      ) : loadError ? (
        <ErrorAlert message={loadError} onRetry={retry} />
      ) : !folha ? (
        <div className="py-16 text-center flex flex-col items-center gap-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-slate-600 font-bold text-lg">A folha de {rotulo} ainda não foi processada.</p>
          <p className="text-slate-400 font-medium text-sm max-w-md">Ao processar, o sistema calcula o holerite de cada colaborador com o cadastro de agora. Você confere antes de fechar o mês.</p>
          <button type="button" onClick={() => executar('processar', processPayroll)} disabled={acao !== null}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-primary text-white text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-60">
            <RefreshCw size={16} /> {acao === 'processar' ? 'Processando...' : 'Processar folha'}
          </button>
          {actionError && <div className="w-full max-w-xl"><ErrorAlert message={actionError} /></div>}
        </div>
      ) : (
        <>
          <div className={`flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl border ${fechada ? 'bg-emerald-50/60 border-emerald-100' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              {fechada ? <Lock size={20} className="shrink-0 text-emerald-600" /> : <CheckCircle2 size={20} className="shrink-0 text-slate-400" />}
              <div>
                <p className="font-black text-slate-900">{fechada ? 'Folha fechada' : 'Folha aberta'}</p>
                <p className="text-sm font-medium text-slate-500">
                  {fechada && folha.fechadaEm
                    ? `Fechada em ${formatarMomento(folha.fechadaEm)}. Os colaboradores já veem o holerite e nada mais muda nesta competência.`
                    : `Processada em ${formatarMomento(folha.processadaEm)}. Alterações no cadastro só entram ao processar de novo.`}
                </p>
              </div>
            </div>
            {!fechada && (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => executar('processar', processPayroll)} disabled={acao !== null}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-60">
                  <RefreshCw size={16} /> {acao === 'processar' ? 'Processando...' : 'Processar novamente'}
                </button>
                <button type="button" onClick={() => setConfirmandoFechamento(true)} disabled={acao !== null || confirmandoFechamento}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-primary text-white text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-60">
                  <Lock size={16} /> Fechar mês
                </button>
              </div>
            )}
          </div>

          {confirmandoFechamento && !fechada && (
            <div role="alertdialog" aria-labelledby="fechar-titulo" className="p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-4">
              <p id="fechar-titulo" className="font-black text-amber-900">Fechar a folha de {rotulo}?</p>
              <p className="text-sm font-medium text-amber-800">
                Depois de fechada, a folha não pode ser processada de novo: salários e dados da empresa passam a valer como estão.
                {folha.pendencias.length > 0 && ` ${folha.pendencias.length} colaborador(es) sem salário ficarão sem holerite neste mês.`}
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => executar('fechar', closePayroll)} disabled={acao !== null}
                  className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60">
                  {acao === 'fechar' ? 'Fechando...' : 'Confirmar fechamento'}
                </button>
                <button type="button" onClick={() => setConfirmandoFechamento(false)} disabled={acao !== null}
                  className="px-5 py-3 bg-white border border-amber-200 text-amber-800 text-sm font-bold rounded-xl transition-all disabled:opacity-60">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {actionError && <ErrorAlert message={actionError} />}

          {folha.pendencias.length > 0 && (
            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-100">
              <div className="flex items-center gap-2 mb-3 text-amber-800">
                <AlertTriangle size={18} />
                <h2 className="font-black">Pendências ({folha.pendencias.length})</h2>
              </div>
              <p className="text-sm font-medium text-amber-800 mb-3">
                {fechada ? 'Estes colaboradores ficaram de fora desta folha e não têm holerite nesta competência.' : 'Estes colaboradores não entraram na folha. Corrija o cadastro e processe de novo.'}
              </p>
              <ul className="divide-y divide-amber-100 text-sm font-medium text-slate-700">
                {folha.pendencias.map((pendencia) => (
                  <li key={pendencia.funcionarioId} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-bold text-slate-900">{pendencia.nome}</span>
                    <span>{pendencia.motivo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PayrollSummaryCards metrics={dynamicMetrics} />
          <PayrollTable payrolls={displayedPayrolls} competencia={competencia} empresa={folha.empresa} />
        </>
      )}
    </div>
  );
};

export default Payroll;
