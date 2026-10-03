import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { RequestStatus } from '../services/requestService';
import Badge from './ui/Badge';

const StatusDaSolicitacao: React.FC<{ status: RequestStatus }> = ({ status }) => {
  switch (status) {
    case 'Aprovada': return <Badge tone="success" className="gap-1.5"><CheckCircle2 size={12} aria-hidden="true" /> Aprovada</Badge>;
    case 'Recusada': return <Badge tone="danger" className="gap-1.5"><XCircle size={12} aria-hidden="true" /> Recusada</Badge>;
    default: return <Badge tone="warning" className="gap-1.5"><Clock size={12} aria-hidden="true" /> Pendente</Badge>;
  }
};

export default StatusDaSolicitacao;
