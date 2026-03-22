import React from 'react';
import { Clock, Check, X } from 'lucide-react';
import './PendingRequests.css';

const PendingRequests = ({ solicitacoes }) => {
  if (!solicitacoes) return null;

  return (
    <div className="pending-requests-card">
      <div className="requests-header">
        <div className="title-group">
          <span className="icon-circle-orange">
            <Clock size={18} color="#f97316" />
          </span>
          <h3>Solicitações Pendentes</h3>
        </div>
      </div>

      <div className="requests-tabs">
        <button className="tab-active">Férias ({solicitacoes.length})</button>
      </div>

      <div className="requests-list">
        {solicitacoes.map((req) => (
          <div key={req.id} className="request-item">
            <div className="request-info">
              <h4 className="request-name">{req.name}</h4>
              <p className="request-period">{req.period}</p>
            </div>
            
            <div className="request-actions">
              <button className="btn-approve">
                <Check size={16} /> Aprovar
              </button>
              <button className="btn-reject">
                <X size={16} /> Rejeitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingRequests;