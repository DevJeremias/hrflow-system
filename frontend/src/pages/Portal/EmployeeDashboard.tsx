import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { pontoService, PointRecord, HistoryDay, MonthTotals } from '../../services/pontoService';
import DashboardPunchCard from '../../components/Portal/DashboardPunchCard';
import DashboardTimeline from '../../components/Portal/DashboardTimeline';
import DashboardTimeMirror from '../../components/Portal/DashboardTimeMirror';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { formatarDataDeBelem, proximosTiposDePonto, type TipoPonto } from '../../utils/ponto';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  
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
  const [monthTotals, setMonthTotals] = useState<MonthTotals | null>(null);

  useEffect(() => {
    if (funcionarioId === null) return;
    let ativo = true;
    Promise.all([
      pontoService.getRegistrosHoje(funcionarioId),
      pontoService.getHistoricoMes(funcionarioId, historyMonth),
      pontoService.getTotaisDoMes(funcionarioId, historyMonth),
    ]).then(([hoje, historico, totais]) => {
      if (!ativo) return;
      setLoadError(null);
      setDailyRecords(hoje);
      setHistoryData(historico);
      setMonthTotals(totais);
    }).catch((error) => {
      if (ativo) setLoadError(mensagemDeErro(error, 'Erro ao carregar o ponto'));
    });
    return () => { ativo = false; };
  }, [funcionarioId, historyMonth, reloadKey]);

  const handlePunchClock = async (tipo: TipoPonto) => {
    setIsRegistering(true);

    if (!navigator.geolocation) {
      alert("O seu navegador não suporta geolocalização.");
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
          // A marcação muda a linha de hoje e os totais do espelho: recarrega o mês, sem esvaziar a tela.
          setReloadKey((k) => k + 1);
        } catch (error: any) {
          alert(error.message || "Erro ao comunicar com o servidor.");
        } finally {
          setIsRegistering(false);
        }
      },
      () => {
        alert("Por favor, permita o acesso à sua localização para registrar o ponto.");
        setIsRegistering(false);
      },
      { enableHighAccuracy: true } 
    );
  };

  // O erro sobe para o modal, que o mostra e mantém o texto digitado; a lista só muda após o servidor confirmar.
  // Enviada ou reenviada, a justificativa volta a ficar pendente para o RH.
  const handleSaveNote = async (id: string, note: string) => {
    await pontoService.salvarJustificativa(id, note);
    setHistoryData(prev => prev.map(day => day.id === id ? { ...day, note: note.trim(), noteStatus: 'pendente', noteReply: null } : day));
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
      {loadError && <ErrorAlert message={loadError} onRetry={() => { setLoadError(null); setReloadKey((k) => k + 1); }} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <DashboardPunchCard 
          isRegistering={isRegistering} 
          proximosTipos={proximosTipos}
          onPunchClock={handlePunchClock} 
        />
        <DashboardTimeline records={dailyRecords} />
      </div>

      <div className="space-y-4">
        <DashboardTimeMirror 
          month={historyMonth} 
          setMonth={setHistoryMonth} 
          historyData={historyData} 
          monthTotals={monthTotals}
          onSaveNote={handleSaveNote} 
        />
      </div>
    </div>
  );
};

export default EmployeeDashboard;