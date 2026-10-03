import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useHistoricoDoMes, usePontoDeHoje, useRegistrarPonto, useSalvarJustificativa, useTotaisDoMes,
} from '../../queries/ponto';
import DashboardPunchCard from '../../components/Portal/DashboardPunchCard';
import DashboardTimeline from '../../components/Portal/DashboardTimeline';
import DashboardTimeMirror from '../../components/Portal/DashboardTimeMirror';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { obterLocalizacao } from '../../utils/localizacao';
import { formatarDataDeBelem, proximosTiposDePonto, type TipoPonto } from '../../utils/ponto';

const SEM_REGISTROS: never[] = [];

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();

  const funcionarioId = user?.funcionarioId ?? null;
  const [historyMonth, setHistoryMonth] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  const [punchError, setPunchError] = useState<string | null>(null);
  // Cobre a captura do GPS, que acontece antes de a mutação começar.
  const [locating, setLocating] = useState(false);

  const hoje = usePontoDeHoje(funcionarioId);
  const historico = useHistoricoDoMes(funcionarioId, historyMonth);
  const totais = useTotaisDoMes(funcionarioId, historyMonth);
  const registrar = useRegistrarPonto();
  const salvarJustificativa = useSalvarJustificativa(funcionarioId, historyMonth);

  const dailyRecords = hoje.data ?? SEM_REGISTROS;
  const falha = hoje.error ?? historico.error ?? totais.error;
  const loadError = falha ? mensagemDeErro(falha, 'Erro ao carregar o ponto') : null;
  const retry = () => { hoje.refetch(); historico.refetch(); totais.refetch(); };

  // Sem o ponto de hoje carregado não se sabe qual é a próxima marcação: o botão espera.
  const punchBlocked = funcionarioId === null || hoje.isPending || locating || registrar.isPending;

  const handlePunchClock = async (tipo: TipoPonto) => {
    setPunchError(null);
    setLocating(true);
    try {
      const localizacao = await obterLocalizacao();
      await registrar.mutateAsync({ tipo, localizacao });
    } catch (error) {
      setPunchError(mensagemDeErro(error, 'Erro ao comunicar com o servidor.'));
    } finally {
      setLocating(false);
    }
  };

  // O erro sobe para o modal, que o mostra e mantém o texto digitado; a lista só muda após o servidor confirmar.
  const handleSaveNote = async (id: string, note: string) => {
    await salvarJustificativa.mutateAsync({ data: id, texto: note });
  };

  const firstName = user?.nome?.split(' ')[0] || 'Utilizador';
  const formattedDate = formatarDataDeBelem(new Date());
  const proximosTipos = proximosTiposDePonto(dailyRecords);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Olá, {firstName}!</h1>
        <p className="text-slate-500 font-medium mt-1 capitalize">{formattedDate}</p>
      </div>

      {funcionarioId === null && (
        <ErrorAlert message="Seu usuário ainda não está vinculado a um colaborador. Procure o RH para registrar e consultar o ponto." />
      )}
      {loadError && <ErrorAlert message={loadError} onRetry={retry} />}
      {punchError && <ErrorAlert message={punchError} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <DashboardPunchCard 
          isRegistering={locating || registrar.isPending}
          disabled={punchBlocked}
          proximosTipos={proximosTipos}
          onPunchClock={handlePunchClock} 
        />
        <DashboardTimeline records={dailyRecords} />
      </div>

      <div className="space-y-4">
        <DashboardTimeMirror 
          month={historyMonth} 
          setMonth={setHistoryMonth} 
          historyData={historico.data ?? SEM_REGISTROS} 
          weeklyData={totais.data?.totals ?? SEM_REGISTROS}
          monthlySummary={totais.data?.monthlySummary ?? null}
          onSaveNote={handleSaveNote} 
        />
      </div>
    </div>
  );
};

export default EmployeeDashboard;