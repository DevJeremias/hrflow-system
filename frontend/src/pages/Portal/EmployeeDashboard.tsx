import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useHistoricoDoMes, usePontoDeHoje, useRegistrarPonto, useSalvarJustificativa, useTotaisDoMes,
} from '../../queries/ponto';
import DashboardPunchCard from '../../components/Portal/DashboardPunchCard';
import DashboardTimeline from '../../components/Portal/DashboardTimeline';
import DashboardTimeMirror from '../../components/Portal/DashboardTimeMirror';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/toastContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { mensagemDeErro } from '../../utils/erros';
import { obterLocalizacao } from '../../utils/localizacao';
import { formatarDataNoFuso, proximosTiposDePonto, type TipoPonto } from '../../utils/ponto';
import { mesAtualNoFuso } from '../../utils/competencia';

const SEM_REGISTROS: never[] = [];

const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const EmployeeDashboard: React.FC = () => {
  usePageTitle('Bater ponto');
  const { user } = useAuth();
  const toast = useToast();

  const funcionarioId = user?.funcionarioId ?? null;
  const [historyMonth, setHistoryMonth] = useState(() => mesAtualNoFuso(user?.empresaFuso));
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
    setLocating(true);
    try {
      const localizacao = await obterLocalizacao();
      await registrar.mutateAsync({ tipo, localizacao });
      toast.success(`Ponto registrado: ${tipo}.`);
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Erro ao comunicar com o servidor.'));
    } finally {
      setLocating(false);
    }
  };

  // O erro sobe para o modal, que o mostra e mantém o texto digitado; a lista só muda após o servidor confirmar.
  // Enviada ou reenviada, a justificativa volta a ficar pendente para o RH.
  const handleSaveNote = async (id: string, note: string) => {
    await salvarJustificativa.mutateAsync({ data: id, texto: note });
  };

  const firstName = user?.nome?.split(' ')[0] || 'Usuário';
  const formattedDate = primeiraMaiuscula(formatarDataNoFuso(new Date(), user?.empresaFuso));
  const proximosTipos = proximosTiposDePonto(dailyRecords);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title={`Olá, ${firstName}!`} description={formattedDate} />

      {funcionarioId === null && (
        <ErrorAlert message="Seu usuário ainda não está vinculado a um colaborador. Procure o RH para registrar e consultar o ponto." />
      )}
      {loadError && <ErrorAlert message={loadError} onRetry={retry} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardPunchCard 
          isRegistering={locating || registrar.isPending}
          disabled={punchBlocked}
          proximosTipos={proximosTipos}
          onPunchClock={handlePunchClock} 
        />
        <DashboardTimeline records={dailyRecords} />
      </div>

      <DashboardTimeMirror
        month={historyMonth}
        setMonth={setHistoryMonth}
        historyData={historico.data ?? SEM_REGISTROS}
        monthTotals={totais.data ?? null}
        onSaveNote={handleSaveNote}
      />
    </div>
  );
};

export default EmployeeDashboard;