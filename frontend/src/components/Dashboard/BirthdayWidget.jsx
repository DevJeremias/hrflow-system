import React from 'react';
import './BirthdayWidget.css';

const BirthdayWidget = ({ dados }) => {
  if (!dados) return null;

  return (
    <div className="birthday-widget">
      <div className="widget-header">
        <span className="icon-circle">🎂</span>
        <h3>Aniversariantes do Mês</h3>
      </div>
      
      <div className="birthday-card-content">
        <div className="birthday-user-info">
          <img src={dados.avatar} alt={dados.name} className="user-avatar" />
          <div className="user-details">
            <span className="user-name">{dados.name}</span>
            <span className="user-role">{dados.role}</span>
          </div>
        </div>
        <div className="birthday-date-badge">
          {dados.date}
        </div>
      </div>
    </div>
  );
};

export default BirthdayWidget;