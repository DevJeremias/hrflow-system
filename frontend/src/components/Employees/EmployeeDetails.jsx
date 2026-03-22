import React, { useState } from 'react';
import { ArrowLeft, Edit2, FileText, UploadCloud } from 'lucide-react';
import './EmployeeDetails.css';

const EmployeeDetails = ({ colaborador, onVoltar, onAbrirEdicao }) => {
  const [abaAtiva, setAbaAtiva] = useState('profissional');

  if (!colaborador) return null;

  return (
    <div className="perfil-container">
      <button className="btn-voltar" onClick={onVoltar}>
        <ArrowLeft size={20} />
        <span>Voltar para Colaboradores</span>
      </button>

      <div className="perfil-header-card">
        <img 
          src={colaborador.avatar || 'https://i.pravatar.cc/150?u=generico'} 
          alt={colaborador.nomeCompleto} 
          className="perfil-avatar-grande" 
        />
        <div className="perfil-info-topo">
          <h2>{colaborador.nomeCompleto || colaborador.nome}</h2>
          <p className="perfil-cargo">{colaborador.cargo}</p>
          <div className="perfil-badges">
            <span className="badge normal">Matrícula: <strong>{colaborador.matricula || 'N/A'}</strong></span>
            <span className="badge normal">Departamento: <strong>{colaborador.departamento || 'N/A'}</strong></span>
            <span className="badge verde">{colaborador.tipoContrato || 'CLT'}</span>
          </div>
        </div>
      </div>

      <div className="perfil-tabs">
        <button 
          className={`tab-btn ${abaAtiva === 'profissional' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('profissional')}
        >
          Profissional
        </button>
        <button 
          className={`tab-btn ${abaAtiva === 'documentos' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('documentos')}
        >
          Documentos
        </button>
      </div>

      <div className="perfil-content">
        {abaAtiva === 'profissional' && (
          <div className="aba-profissional">
            
            <div className="info-block">
              <div className="block-header">
                <h3>Dados Pessoais</h3>
                <button className="btn-editar-bloco" onClick={() => onAbrirEdicao(colaborador)}>
                  <Edit2 size={16} /> Editar
                </button>
              </div>
              <div className="info-grid">
                <div className="info-item">
                  <label>Nome Completo</label>
                  <span>{colaborador.nomeCompleto || colaborador.nome}</span>
                </div>
                <div className="info-item">
                  <label>E-mail Pessoal</label>
                  <span>{colaborador.emailPessoal || '-'}</span>
                </div>
                <div className="info-item">
                  <label>Telefone</label>
                  <span>{colaborador.telefone || '-'}</span>
                </div>
                <div className="info-item">
                  <label>CPF</label>
                  <span>{colaborador.cpf || '-'}</span>
                </div>
                <div className="info-item">
                  <label>Data de Nascimento</label>
                  <span>{colaborador.dataNascimento ? new Date(colaborador.dataNascimento).toLocaleDateString('pt-BR') : '-'}</span>
                </div>
              </div>
            </div>

            <hr className="divisor" />

            <div className="info-block">
              <div className="block-header">
                <h3>Dados Profissionais</h3>
              </div>
              <div className="info-grid">
                <div className="info-item">
                  <label>Cargo</label>
                  <span>{colaborador.cargo || '-'}</span>
                </div>
                <div className="info-item">
                  <label>Data de Admissão</label>
                  <span>{colaborador.dataAdmissao ? new Date(colaborador.dataAdmissao).toLocaleDateString('pt-BR') : '-'}</span>
                </div>
                <div className="info-item">
                  <label>Salário Base</label>
                  <span>R$ {colaborador.salarioBase || '0,00'}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {abaAtiva === 'documentos' && (
          <div className="aba-documentos">
            <div className="documentos-header">
              <h3>Documentos do Colaborador</h3>
              <button className="btn-upload">
                <UploadCloud size={16} /> Upload Documento
              </button>
            </div>
            <div className="documento-item">
              <FileText size={24} color="#3b82f6" />
              <div className="doc-info">
                <strong>Contrato de Trabalho - {colaborador.nome.split(' ')[0]}.pdf</strong>
                <span>2.3 MB • Adicionado em 14/01/2020</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetails;