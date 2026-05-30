import React from 'react';
import { Play, Coffee, Square, CheckCircle2, Clock } from 'lucide-react';
import { PointRecord } from '../../../services/pontoService';

interface Props {
  records: PointRecord[];
}

const DailyTimeline: React.FC<Props> = ({ records }) => {
  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'Entrada': return <Play size={16} className="text-emerald-500" />;
      case 'Pausa Almoço': return <Coffee size={16} className="text-amber-500" />;
      case 'Retorno Almoço': return <Play size={16} className="text-indigo-500" />;
      case 'Saída': return <Square size={16} className="text-rose-500" />;
      default: return <CheckCircle2 size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden flex flex-col group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 blur-[50px] rounded-full pointer-events-none transition-colors duration-1000 group-hover:bg-indigo-100/50"></div>
      
      <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-slate-900 z-10">
        Registros de Hoje
        <span className="bg-slate-100 text-slate-600 text-xs py-1 px-3 rounded-full font-bold">
          {records.length}/4
        </span>
      </h3>

      {records.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center gap-4 z-10">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2">
            <Clock size={24} className="text-slate-300" />
          </div>
          <p className="font-medium text-sm">Nenhum ponto registrado<br/>neste momento.</p>
        </div>
      ) : (
        <div className="flex-1 relative">
          {/* Linha vertical clara */}
          <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-100"></div>
          
          <div className="space-y-6 relative">
            {records.map((reg, index) => {
              const type = reg.type || (reg as any).tipo || 'Desconhecido';
              const time = reg.time || (reg as any).horario || '--:--';

              return (
                <div key={reg.id || index} className="flex gap-6 relative z-10 animate-in slide-in-from-left-2">
                  
                  {/* Ícone */}
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm z-10">
                    {getRecordIcon(type)}
                  </div>
                  
                  {/* Textos */}
                  <div className="flex flex-col justify-center">
                    <span className="text-sm font-bold text-slate-500">{type}</span>
                    <span className="text-2xl font-black tracking-tight text-slate-900">{time}</span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyTimeline;