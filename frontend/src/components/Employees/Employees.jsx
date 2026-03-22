import React, { useState, useEffect } from 'react'; 
import NavPage from '../Layout/Layout'; 
import ColaboradoresTable from './DirectoryTable';
import ModalCadastro from './EmployeeForm'; 
import PerfilColaborador from './EmployeeDetails'; 
import { Plus, Search } from 'lucide-react';
import './Employees.css';
import { buscarColaboradores, salvarColaborador } from '../../services/colaboradoresService';

const Employees = () => {
  const [colaboradores, setColaboradores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState(null);  
  const [colaboradorVisualizando, setColaboradorVisualizando] = useState(null);

  useEffect(() => {
    const carregarDados = async () => {
      const dadosDoBanco = await buscarColaboradores();
      setColaboradores(dadosDoBanco);
    };
    carregarDados();
  }, []);

  const handleAbrirNovoCadastro = () => {
    setColaboradorParaEditar(null);
    setIsModalOpen(true);
  };

  const handleAbrirEdicao = (colaborador) => {
    setColaboradorParaEditar(colaborador);
    setIsModalOpen(true);
  };

  const handleSalvarColaborador = async (dadosDoFormulario) => {
    try {
      const colaboradorSalvo = await salvarColaborador(dadosDoFormulario);
      
      if (dadosDoFormulario.id) {
        setColaboradores(colaboradores.map(colab => colab.id === colaboradorSalvo.id ? colaboradorSalvo : colab));
        if (colaboradorVisualizando && colaboradorVisualizando.id === colaboradorSalvo.id) {
          setColaboradorVisualizando(colaboradorSalvo);
        }
      } else {
        setColaboradores([...colaboradores, colaboradorSalvo]);
      }
    } catch (erro) {
      alert("Erro ao salvar.");
    }
  };

  return (
    <NavPage>
      <div className="colaboradores-content">
        
        {colaboradorVisualizando ? (
          
          <PerfilColaborador 
            colaborador={colaboradorVisualizando} 
            onVoltar={() => setColaboradorVisualizando(null)} 
            onAbrirEdicao={handleAbrirEdicao}
          />

        ) : (
          <>
            <div className="colaboradores-header-wrapper">
              <div className="header-title-section">
                <h2>Colaboradores</h2>
                <p>Gerencie as informações dos funcionários da empresa.</p>
              </div>
              <div className="header-actions-section">
                <div className="search-bar-list">
                  <Search size={18} color="#94a3b8" />
                  <input type="text" placeholder="Buscar por nome ou cargo..." />
                </div>
                <button className="btn-add-colaborador" onClick={handleAbrirNovoCadastro}>
                  <Plus size={18} /> Adicionar Novo
                </button>
              </div>
            </div>

            <div className="table-container-card">
              <ColaboradoresTable 
                dados={colaboradores} 
                onVerPerfil={(colab) => setColaboradorVisualizando(colab)} 
              />
            </div>
          </>
        )}

      </div>
      
      <ModalCadastro 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSalvarColaborador} 
        colaboradorEditando={colaboradorParaEditar} 
      />
    </NavPage>
  );
};

export default Employees;