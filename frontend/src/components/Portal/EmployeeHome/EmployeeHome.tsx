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

  useEffect(() => {
    pontoService.getRegistrosHoje().then(setDailyRecords);
  }, []);

  useEffect(() => {
    // Carrega a tabela de espelho diário
    pontoService.getHistoricoMes(historyMonth).then(setHistoryData);
    
    pontoService.getTotaisSemanais(historyMonth).then((res) => {
      setWeeklyData(res.totals);
      setMonthlySummary(res.monthlySummary);
    });
  }, [historyMonth]);

  const handlePunchClock = async () => {
    setIsRegistering(true);
    try {
      const types: PointRecord['type'][] = ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída'];
      const nextType = types[dailyRecords.length] || 'Entrada';
      const newRecord = await pontoService.registrar(nextType);
      setDailyRecords([...dailyRecords, newRecord]);
    } catch (error) {
      alert("Erro ao registrar o ponto.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSaveNote = async (id: string, note: string) => {
    try {
      await pontoService.salvarJustificativa(id, note);
      setHistoryData(prev => prev.map(day => day.id === id ? { ...day, note } : day));
    } catch (error) {
      alert("Erro ao salvar justificativa.");
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Colaborador';
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