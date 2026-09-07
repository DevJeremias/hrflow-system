import React, { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { pontoService } from '../../services/pontoService';

interface MessageState {
  text: string;
  type: 'success' | 'error' | '';
}

const DashboardPunchForm: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<MessageState>({ text: '', type: '' });
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClockIn = () => {
    setIsLoading(true);
    setMessage({ text: '', type: '' });

    if (!('geolocation' in navigator)) {
      setMessage({ text: 'Seu navegador não suporta geolocalização.', type: 'error' });
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // O serviço centraliza o resgate do ID e a montagem do payload com as chaves corretas
          await pontoService.registrar('Entrada', { lat: latitude, lng: longitude });

          setMessage({ text: 'Ponto registrado com sucesso!', type: 'success' });
        } catch (error: any) {
          setMessage({ text: error.message || 'Erro ao registrar ponto no servidor.', type: 'error' });
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("Erro de GPS:", error);
        setMessage({ text: 'Por favor, permita o acesso à sua localização para registrar o ponto.', type: 'error' });
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="flex justify-center items-center p-8 w-full">
      <div className="bg-white rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.05)] p-10 w-full max-w-[450px] flex flex-col items-center text-center border border-slate-100">
        
        <div className="mb-2">
          <h2 className="text-slate-900 text-2xl font-semibold mb-2">Registro de Ponto</h2>
          <p className="text-slate-500 text-[0.95rem] capitalize mb-8">
            {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 bg-slate-50 py-6 px-8 rounded-xl w-full mb-8 border border-slate-200">
          <Clock size={32} className="text-blue-500" />
          <span className="text-[2.5rem] font-bold text-slate-800 tabular-nums leading-none">
            {currentTime.toLocaleTimeString('pt-BR')}
          </span>
        </div>
        
        <button 
          onClick={handleClockIn} 
          disabled={isLoading}
          className={`
            w-full py-4 px-8 rounded-xl text-[1.1rem] font-semibold transition-all duration-300
            ${isLoading 
              ? 'bg-slate-300 text-slate-600 animate-pulse cursor-not-allowed shadow-none' 
              : 'bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)] hover:bg-blue-600 hover:-translate-y-[2px] hover:shadow-[0_6px_16px_rgba(59,130,246,0.4)] active:translate-y-0 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none'
            }
          `}
        >
          {isLoading ? 'Processando...' : 'Bater Ponto Agora'}
        </button>

        {message.text && (
          <div className={`mt-6 p-4 rounded-lg flex items-center gap-2.5 w-full text-[0.95rem] text-left border ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border-green-200' 
              : 'bg-red-100 text-red-800 border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-slate-400 text-[0.85rem] w-full">
          <MapPin size={16} className="shrink-0" />
          <span>A sua localização será registrada por motivos de segurança.</span>
        </div>

      </div>
    </div>
  );
};

export default DashboardPunchForm;