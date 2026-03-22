import React from 'react';
import './NoticeBoard.css';
import { Plus } from 'lucide-react';

const NoticeBoard = ({ avisos }) => {
  if (!avisos) return null;

  return (
    <div className="notice-board">
      <div className="notice-header">
        <div className="title-group">
          <span className="icon-circle-blue">📢</span>
          <h3>Mural de Avisos</h3>
        </div>
        <button className="add-notice-btn">
          <Plus size={18} />
        </button>
      </div>

      <div className="notices-list">
        {avisos.map(notice => (
          <div key={notice.id} className="notice-item">
            <h4 className="notice-title">{notice.title}</h4>
            <p className="notice-desc">{notice.desc}</p>
            <span className="notice-tag">{notice.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NoticeBoard;