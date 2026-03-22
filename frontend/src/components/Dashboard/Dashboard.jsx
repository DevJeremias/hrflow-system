import React, { useState, useEffect } from 'react';
import NavPage from '../Layout/Layout'; 
import StatCard from './StatCard';
import BirthdayWidget from './BirthdayWidget';
import PendingRequests from './PendingRequests';
import NoticeBoard from './NoticeBoard';
import './Dashboard.css';
import { Users, Cake, Clock, UserCheck } from 'lucide-react';
import { buscarDadosDashboard } from '../../services/dashboardService';

const Dashboard = () => {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregarDashboard = async () => {
      try {
        const dadosDoBanco = await buscarDadosDashboard();
        setDados(dadosDoBanco); 
      } catch (erro) {
        console.error("Erro ao carregar o dashboard:", erro);
      } finally {
        setCarregando(false);
      }
    };

    carregarDashboard();
  }, []);

  if (carregando) {
    return (
      <NavPage>
        <div className="dashboard-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <h2 style={{ color: '#64748b' }}>Carregando seu painel...</h2>
        </div>
      </NavPage>
    );
  }

  if (!dados) return null;

  return (
    <NavPage>
      <div className="dashboard-content">
        
        <div className="dashboard-welcome">
          <h2>Dashboard</h2>
          <p>Bem-vindo ao painel de administração</p>
        </div>

        <div className="stats-container">
          <StatCard 
            title="Total de Colaboradores" 
            value={dados.estatisticas.totalColaboradores} 
            icon={<Users size={22} />} 
            color="blue" 
          />
          <StatCard 
            title="Aniversariantes do Mês" 
            value={dados.estatisticas.aniversariantesMes} 
            icon={<Cake size={22} />} 
            color="purple" 
          />
          <StatCard 
            title="Solicitações Pendentes" 
            value={dados.estatisticas.solicitacoesPendentes} 
            icon={<Clock size={22} />} 
            color="orange" 
          />
          <StatCard 
            title="Presença Hoje" 
            value={dados.estatisticas.presencaHoje} 
            icon={<UserCheck size={22} />} 
            color="green" 
          />
        </div>

        <div className="main-grid">
          <div className="grid-item">
            
            <BirthdayWidget dados={dados.aniversarianteDestaque} />
          </div>
          <div className="grid-item">
            
            <PendingRequests solicitacoes={dados.solicitacoes} />
          </div>
        </div>

        <NoticeBoard avisos={dados.avisos} />
        
      </div>
    </NavPage>
  );
};

export default Dashboard;