import React, { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { registarPontoAPI } from '../../services/pontoService'; // Importação do serviço real
import './RelogioPonto.css';

const RelogioPonto = () => {
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Atualiza o relógio na tela a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const registrarPonto = () => {
    setLoading(true);
    setMensagem({ texto: '', tipo: '' });

    if (!('geolocation' in navigator)) {
      setMensagem({ texto: 'Seu navegador não suporta geolocalização.', tipo: 'erro' });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        
        console.log(`Coordenadas capturadas: Lat ${latitude}, Lng ${longitude}`);
        
        try {
          // Pega o ID do funcionário logado (assumindo que será salvo no localStorage após o login)
          // O "1" serve de fallback provisório para a tela não quebrar enquanto você testa
          const funcionarioId = localStorage.getItem('funcionarioId') || 1;

          const payloadPonto = {
            funcionario_id: funcionarioId,
            latitude: latitude,
            longitude: longitude,
            tipo_registro: 'Entrada', // Posteriormente podemos adicionar botões para escolher o tipo
            observacao: 'Ponto batido via web'
          };

          // Dispara os dados reais para o Back-end
          await registarPontoAPI(payloadPonto);

          setMensagem({ texto: 'Ponto registrado com sucesso!', tipo: 'sucesso' });
        } catch (erro) {
          setMensagem({ texto: erro.message || 'Erro ao registrar ponto no servidor.', tipo: 'erro' });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Erro de GPS:", error);
        setMensagem({ texto: 'Por favor, permita o acesso à sua localização para registrar o ponto.', tipo: 'erro' });
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="ponto-container">
      <div className="ponto-card">
        <div className="ponto-header">
          <h2>Registro de Ponto</h2>
          <p className="data-atual">
            {horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="relogio-display">
          <Clock size={32} className="relogio-icon" />
          <span className="hora-exata">{horaAtual.toLocaleTimeString('pt-BR')}</span>
        </div>
        
        <button 
          className={`btn-bater-ponto ${loading ? 'loading' : ''}`}
          onClick={registrarPonto} 
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Bater Ponto Agora'}
        </button>

        {mensagem.texto && (
          <div className={`mensagem-alerta ${mensagem.tipo}`}>
            {mensagem.tipo === 'sucesso' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{mensagem.texto}</span>
          </div>
        )}

        <div className="ponto-footer">
          <MapPin size={16} />
          <span>A sua localização será registrada por motivos de segurança.</span>
        </div>
      </div>
    </div>
  );
};

export default RelogioPonto;