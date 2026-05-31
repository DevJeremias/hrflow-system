import React, { useState, useEffect } from 'react';
import { LogOut, Calendar, User, List, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RelogioPonto from '../Ponto/RelogioPonto';
import { buscarHistoricoPontos } from '../../services/pontoService';
import './DashboardColaborador.css';

const DashboardColaborador = () => {
  const navigate = useNavigate();
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const nomeUsuario = localStorage.getItem('nomeUsuario') || 'Colaborador';

  const carregarHistorico = async () => {
    setLoading(true);
    setErro('');
    try {
      const dados = await buscarHistoricoPontos();
      setHistorico(dados);
    } catch (err) {
      setErro('Não foi possível carregar o histórico de pontos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="dashboard-colaborador-layout">
      {/* Barra Superior */}
      <header className="colaborador-header">
        <div className="header-logo">
          <span className="logo-badge">HR</span>
          <h1>HRFlow Portal</h1>
        </div>
        <div className="header-profile">
          <div className="profile-details">
            <span className="profile-welcome">Olá,</span>
            <span className="profile-username">{nomeUsuario}</span>
          </div>
          <button className="btn-logout-colaborador" onClick={handleLogout} title="Sair do Sistema">
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="colaborador-main-content">
        <section className="welcome-banner">
          <h2>Painel do Colaborador</h2>
          <p>Gerencie os seus horários e registe a sua presença diária com segurança e geolocalização.</p>
        </section>

        <div className="dashboard-grid-colaborador">
          {/* Coluna da Esquerda: Área de Batida de Ponto */}
          <div className="grid-card-ponto">
            <RelogioPonto />
          </div>

          {/* Coluna da Direita: Histórico de Registos */}
          <div className="grid-card-historico">
            <div className="historico-header">
              <div className="historico-title">
                <List size={20} className="icon-blue" />
                <h3>Os Seus Registos Recentes</h3>
              </div>
              <button className="btn-atualizar-historico" onClick={carregarHistorico} title="Atualizar Histórico">
                <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              </button>
            </div>

            <div className="historico-body">
              {loading ? (
                <div className="historico-status">Carregando histórico...</div>
              ) : erro ? (
                <div className="historico-status erro-msg">{erro}</div>
              ) : historico.length === 0 ? (
                <div className="historico-status vazio-msg">Nenhum registo de ponto encontrado para este mês.</div>
              ) : (
                <div className="table-responsive-ponto">
                  <table className="tabela-pontos">
                    <thead>
                      <tr>
                        <th>Data / Hora</th>
                        <th>Tipo</th>
                        <th>Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((ponto) => (
                        <tr key={ponto.id}>
                          <td className="col-data-hora">
                            <Calendar size={14} />
                            <span>
                              {new Date(ponto.data_hora_oficial).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-tipo ${ponto.tipo_registro.toLowerCase().replace(' ', '-')}`}>
                              {ponto.tipo_registro}
                            </span>
                          </td>
                          <td className="col-obs">{ponto.observacao || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardColaborador;