// src/components/Portal/EmployeeHome/EmployeeHome.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../AuthContext';
import { pontoService, PointRecord, HistoryDay, WeeklyTotal } from '../../../services/pontoService';
import TimeClockCard from './TimeClockCard';
import DailyTimeline from './DailyTimeline';
import HistoryTable from './HistoryTable';
import WeeklyTotalsTable from './WeeklyTotalsTable';

const EmployeeHome: React.FC = () => {
  const { user } = useAuth();
  
  const [dailyRecords, setDailyRecords] = useState<PointRecord[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [historyMonth, setHistoryMonth] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [historyData, setHistoryData] = useState<HistoryDay[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyTotal[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);

  // Busca os registros reais que já estão no Banco de Dados para hoje
  useEffect(() => {
    pontoService.getRegistrosHoje().then(setDailyRecords);
  }, []);

  // Busca os históricos reais do mês selecionado
  useEffect(() => {
    pontoService.getHistoricoMes(historyMonth).then(setHistoryData);
    pontoService.getTotaisSemanais(historyMonth).then((res) => {
      setWeeklyData(res.totals);
      setMonthlySummary(res.monthlySummary);
    });
  }, [historyMonth]);

  // A FUNÇÃO REAL DE BATER O PONTO COM GPS
  const handlePunchClock = async () => {
    setIsRegistering(true);

    if (!navigator.geolocation) {
      alert("O seu navegador não suporta geolocalização.");
      setIsRegistering(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const types: string[] = ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída'];
          // Se já bateu 4 vezes, ele começa a marcar como 'Extra' ou usa o último
          const nextType = types[dailyRecords.length] || 'Extra'; 
          
          const localizacao = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          // Dispara para o seu Node.js
          const newRecord = await pontoService.registrar(nextType, localizacao);
          
          // Atualiza a tela com a resposta do Back-end
          setDailyRecords([...dailyRecords, newRecord]);
          
        } catch (error: any) {
          alert(error.message || "Erro ao comunicar com o servidor.");
        } finally {
          setIsRegistering(false);
        }
      },
      (error) => {
        alert("Por favor, permita o acesso à sua localização para registrar o ponto.");
        setIsRegistering(false);
      },
      { enableHighAccuracy: true } // Força a precisão máxima do GPS
    );
  };

  const handleSaveNote = async (id: string, note: string) => {
    try {
      await pontoService.salvarJustificativa(id, note);
      setHistoryData(prev => prev.map(day => day.id === id ? { ...day, note } : day));
    } catch (error) {
      alert("Erro ao salvar justificativa.");
    }
  };

  const firstName = user?.nome?.split(' ')[0] || 'Utilizador';
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Olá, {firstName}!</h1>
        <p className="text-slate-500 font-medium mt-1 capitalize">{formattedDate}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <TimeClockCard 
          isRegistering={isRegistering} 
          isDayComplete={dailyRecords.length >= 4} 
          onPunchClock={handlePunchClock} 
        />
        <DailyTimeline records={dailyRecords} />
      </div>

      <div className="space-y-4">
        <HistoryTable 
          month={historyMonth} 
          setMonth={setHistoryMonth} 
          data={historyData} 
          onSaveNote={handleSaveNote} 
        />
        
        <WeeklyTotalsTable 
          data={weeklyData} 
          monthlySummary={monthlySummary} 
        />
      </div>

    </div>
  );
};

export default EmployeeHome;