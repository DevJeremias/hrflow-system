import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, icon, color }) => {
  return (
    <div className={`stat-card border-${color}`}>
      <div className="stat-info">
        <span className="stat-title">{title}</span>
        <h3 className="stat-value">{value}</h3>
      </div>
      <div className={`stat-icon-wrapper icon-${color}`}>
        {icon}
      </div>
    </div>
  );
};

export default StatCard;