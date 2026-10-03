import React from 'react';
import { FileText, Eye, Calendar, Download } from 'lucide-react';
import { Payslip } from '../../services/payrollService';
import { rotuloDaCompetencia } from '../../utils/competencia';
import Button, { IconButton } from '../ui/Button';
import Card, { CardHeader } from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';

interface Props {
  payslips: Payslip[];
  onOpenPayslip: (payslip: Payslip) => void;
  onDownloadPdf: (payslip: Payslip) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface Linha { payroll: Payslip; monthLabel: string; }

const PayslipsTable: React.FC<Props> = ({ payslips, onOpenPayslip, onDownloadPdf }) => {
  const linhas: Linha[] = payslips.map((payroll) => ({ payroll, monthLabel: rotuloDaCompetencia(payroll.competencia) }));

  const columns: Column<Linha>[] = [
    {
      key: 'month',
      header: 'Mês de referência',
      cell: ({ monthLabel }) => (
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="rounded-control bg-brand-soft p-2 text-brand"><FileText size={16} /></span>
          <span className="font-semibold text-ink">{monthLabel}</span>
        </span>
      ),
    },
    { key: 'gross', header: 'Salário bruto', align: 'center', cell: ({ payroll }) => <span className="text-ink-muted">{formatCurrency(payroll.totalGross)}</span> },
    { key: 'deductions', header: 'Descontos', align: 'center', cell: ({ payroll }) => <span className="text-danger">- {formatCurrency(payroll.totalDeductions)}</span> },
    { key: 'net', header: 'Valor líquido', align: 'center', cell: ({ payroll }) => <span className="font-bold text-ink">{formatCurrency(payroll.netSalary)}</span> },
    {
      key: 'action',
      header: 'Ação',
      align: 'right',
      semRotuloNoCartao: true,
      cell: ({ payroll, monthLabel }) => (
        <span className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button size="sm" aria-label={`Visualizar holerite de ${monthLabel}`} onClick={() => onOpenPayslip(payroll)} icon={<Eye size={14} aria-hidden="true" />}>
            Visualizar
          </Button>
          <IconButton label={`Baixar PDF do holerite de ${monthLabel}`} variant="secondary" size="sm" onClick={() => onDownloadPdf(payroll)}>
            <Download size={16} aria-hidden="true" />
          </IconButton>
        </span>
      ),
    },
  ];

  return (
    <Card as="section" padding="none" className="overflow-hidden">
      <CardHeader title="Holerites das folhas fechadas" icon={<Calendar size={20} />} />
      <div className="p-3 md:p-0">
        <DataTable caption="Holerites disponíveis" columns={columns} rows={linhas} rowKey={({ payroll }) => payroll.competencia} />
      </div>
    </Card>
  );
};

export default PayslipsTable;
