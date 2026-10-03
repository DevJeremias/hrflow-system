import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { pontoService, PointRecord, HistoryDay, WeeklyTotal } from '../../services/pontoService';
import DashboardPunchCard from '../../components/Portal/DashboardPunchCard';
import DashboardTimeline from '../../components/Portal/DashboardTimeline';
import DashboardTimeMirror from '../../components/Portal/DashboardTimeMirror';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/toastContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { mensagemDeErro } from '../../utils/erros';
import { formatarDataDeBelem, proximosTiposDePonto, type TipoPonto } from '../../utils/ponto';

const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const EmployeeDashboard: React.FC = () => {
  usePageTitle('Bater ponto');
  const { user } = useAuth();
  const toast = useToast();

  const funcionarioId = user?.funcionarioId ?? null;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dailyRecords, setDailyRecords] = useState<PointRecord[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [historyMonth, setHistoryMonth] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [historyData, setHistoryData] = useState<HistoryDay[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyTotal[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<Omit<WeeklyTotal, 'id' | 'weekLabel'> | null>(null);

  useEffect(() => {
    if (funcionarioId === null) return;
    let ativo = true;
    Promise.all([
      pontoService.getRegistrosHoje(funcionarioId),
      pontoService.getHistoricoMes(funcionarioId, historyMonth),
      pontoService.getTotaisSemanais(funcionarioId, historyMonth),
    ]).then(([hoje, historico, totais]) => {
      if (!ativo) return;
      setLoadError(null);
      setDailyRecords(hoje);
      setHistoryData(historico);
      setWeeklyData(totais.totals);
      setMonthlySummary(totais.monthlySummary);
    }).catch((error) => {
      if (ativo) setLoadError(mensagemDeErro(error, 'Erro ao carregar o ponto'));
    });
    return () => { ativo = false; };
  }, [funcionarioId, historyMonth, reloadKey]);

  const handlePunchClock = async (tipo: TipoPonto) => {
    setIsRegistering(true);

    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.");
      setIsRegistering(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const localizacao = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          const newRecord = await pontoService.registrar(tipo, localizacao);
          
          setDailyRecords((registros) => [...registros, newRecord]);
          toast.success(`Ponto registrado: ${tipo}.`);
        } catch (error) {
          toast.error(mensagemDeErro(error, "Erro ao comunicar com o servidor."));
        } finally {
          setIsRegistering(false);
        }
      },
      () => {
        toast.error("Por favor, permita o acesso à sua localização para registrar o ponto.");
        setIsRegistering(false);
      },
      { enableHighAccuracy: true } 
    );
  };

  // O erro sobe para o modal, que o mostra e mantém o texto digitado; a lista só muda após o servidor confirmar.
  const handleSaveNote = async (id: string, note: string) => {
    await pontoService.salvarJustificativa(id, note);
    setHistoryData(prev => prev.map(day => day.id === id ? { ...day, note: note.trim() } : day));
  };

  const firstName = user?.nome?.split(' ')[0] || 'Usuário';
  const formattedDate = primeiraMaiuscula(formatarDataDeBelem(new Date()));
  const proximosTipos = proximosTiposDePonto(dailyRecords);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title={`Olá, ${firstName}!`} description={formattedDate} />

      {funcionarioId === null && (
        <ErrorAlert message="Seu usuário ainda não está vinculado a um colaborador. Procure o RH para registrar e consultar o ponto." />
      )}
      {loadError && <ErrorAlert message={loadError} onRetry={() => { setLoadError(null); setReloadKey((k) => k + 1); }} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardPunchCard 
          isRegistering={isRegistering} 
          proximosTipos={proximosTipos}
          onPunchClock={handlePunchClock} 
        />
        <DashboardTimeline records={dailyRecords} />
      </div>

      <DashboardTimeMirror
        month={historyMonth}
        setMonth={setHistoryMonth}
        historyData={historyData}
        weeklyData={weeklyData}
        monthlySummary={monthlySummary}
        onSaveNote={handleSaveNote}
      />
    </div>
  );
};

export default EmployeeDashboard;