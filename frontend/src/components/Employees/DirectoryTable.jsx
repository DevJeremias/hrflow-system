import React from 'react';
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import './DirectoryTable.css';

const DirectoryTable = ({ dados, onVerPerfil  }) => {
  if (!dados || dados.length === 0) {
    return <div className="empty-table-msg" style={{ padding: '2rem', textAlign: 'center' }}>Nenhum colaborador encontrado.</div>;
  }

  return (
    <div className="table-responsive-wrapper">
      <table className="modern-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Cargo</th>
            <th>Status</th>
            <th className="text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((colab) => (
            <tr key={colab.id}>
              <td><span className="id-badge">#{colab.id}</span></td>
              <td>
                <div className="user-info-cell">
                  <img src={colab.avatar || 'https://i.pravatar.cc/150?u=generico'} alt="Avatar" className="user-avatar-tiny" />
                  <span>{colab.nomeCompleto || colab.nome}</span>
                </div>
              </td>
              <td className="cargo-text">{colab.cargo}</td>
              <td>
                <span className={`status-badge ${(colab.status || 'Ativo').toLowerCase()}`}>
                  {colab.status || 'Ativo'}
                </span>
              </td>
              <td>
                <div className="actions-cell">
                  <button className="btn-icon-action edit" title="Editar" onClick={() => onVerPerfil(colab)}>
                    <Edit2 size={16} />
                  </button>
                  <button className="btn-icon-action delete" title="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-pagination">
        <span>Mostrando {dados.length} colaboradores</span>
        <div className="pagination-buttons">
          <button disabled>Anterior</button>
          <button className="active">1</button>
          <button disabled>Próximo</button>
        </div>
      </div>
    </div>
  );
};

export default DirectoryTable;