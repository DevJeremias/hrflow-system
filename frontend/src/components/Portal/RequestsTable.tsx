import React, { useState } from 'react';
import { FileText, Filter } from 'lucide-react';
import { EmployeeRequest, RequestStatus, RequestType } from '../../services/requestService';
import { TIPOS_DE_SOLICITACAO, formatarDia, rotuloDosDias } from '../../utils/solicitacoes';
import AnexoDaSolicitacao from '../AnexoDaSolicitacao';
import StatusDaSolicitacao from '../StatusDaSolicitacao';
import Card, { CardHeader } from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';
import Field, { Select } from '../ui/Field';

interface Props {
  requests: EmployeeRequest[];
}

const columns: Column<EmployeeRequest>[] = [
  {
    key: 'type',
    header: 'Tipo / Data do pedido',
    cell: (req) => (
      <>
        <p className="font-semibold text-ink">{req.type}</p>
        <p className="mt-0.5 text-xs text-ink-muted">Feito em {formatarDia(req.requestDate)}</p>
      </>
    ),
  },
  {
    key: 'period',
    header: 'Período solicitado',
    cell: (req) => (
      <>
        <span className="font-semibold text-ink lg:whitespace-nowrap">{formatarDia(req.startDate)} <span className="mx-1 font-normal text-ink-muted">até</span> {formatarDia(req.endDate)}</span>
        <p className="mt-0.5 text-xs text-ink-muted">{rotuloDosDias(req.days)}</p>
      </>
    ),
  },
  { key: 'observation', header: 'Observação', cell: (req) => <p className="max-w-[16rem] truncate text-ink-muted" title={req.observation}>{req.observation}</p> },
  { key: 'attachment', header: 'Anexo', align: 'center', cell: (req) => <AnexoDaSolicitacao request={req} /> },
  {
    key: 'status',
    header: 'Status',
    align: 'right',
    cell: (req) => (
      <>
        <StatusDaSolicitacao status={req.status} />
        {req.reply && <p className="mt-1.5 max-w-[16rem] text-xs text-ink-muted md:ml-auto">{req.status === 'Recusada' ? 'Motivo: ' : ''}{req.reply}</p>}
      </>
    ),
  },
];

const RequestsTable: React.FC<Props> = ({ requests }) => {
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'Todos'>('Todos');
  const [filterType, setFilterType] = useState<RequestType | 'Todos'>('Todos');

  const filteredRequests = requests.filter(req => {
    const matchStatus = filterStatus === 'Todos' || req.status === filterStatus;
    const matchType = filterType === 'Todos' || req.type === filterType;
    return matchStatus && matchType;
  });

  return (
    <Card as="section" padding="none" className="mt-8 overflow-hidden">
      <CardHeader
        title="Histórico de Solicitações"
        icon={<FileText size={20} />}
        actions={(
          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-muted"><Filter size={16} aria-hidden="true" /> Filtrar por:</span>
            <Field label="Tipo" name="filtroTipo" hideLabel className="w-full sm:w-52">
              <Select value={filterType} onChange={(e) => setFilterType(e.target.value as RequestType | 'Todos')}>
                <option value="Todos">Todos os Tipos</option>
                {TIPOS_DE_SOLICITACAO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </Select>
            </Field>
            <Field label="Status" name="filtroStatus" hideLabel className="w-full sm:w-48">
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as RequestStatus | 'Todos')}>
                <option value="Todos">Todos os Status</option>
                <option value="Pendente">Pendentes</option>
                <option value="Aprovada">Aprovadas</option>
                <option value="Recusada">Recusadas</option>
              </Select>
            </Field>
          </div>
        )}
      />
      <div className="p-3 lg:p-0">
        <DataTable
          caption="Histórico de solicitações"
          columns={columns}
          rows={filteredRequests}
          rowKey={(req) => req.id}
          stackBelow="lg"
          compact
          empty={<p className="px-6 py-12 text-center font-semibold text-ink-muted">Nenhuma solicitação encontrada para os filtros selecionados.</p>}
        />
      </div>
    </Card>
  );
};

export default RequestsTable;
