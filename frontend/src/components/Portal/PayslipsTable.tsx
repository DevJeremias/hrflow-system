import React from 'react';
import { FileText, Eye, Calendar } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';
import Button from '../ui/Button';
import Card, { CardHeader } from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';

interface Props {
  payslips: EmployeePayroll[];
  monthsLabels: string[];
  onOpenPayslip: (payroll: EmployeePayroll, monthLabel: string) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface Linha { payroll: EmployeePayroll; monthLabel: string; index: number; }

const PayslipsTable: React.FC<Props> = ({ payslips, monthsLabels, onOpenPayslip }) => {
  const linhas: Linha[] = payslips.map((payroll, index) => ({ payroll, monthLabel: monthsLabels[index] || 'Mês Anterior', index }));

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
        <Button size="sm" aria-label={`Visualizar holerite de ${monthLabel}`} onClick={() => onOpenPayslip(payroll, monthLabel)} icon={<Eye size={14} aria-hidden="true" />}>
          Visualizar
        </Button>
      ),
    },
  ];

  return (
    <Card as="section" padding="none" className="overflow-hidden">
      <CardHeader title="Demonstrativo calculado com os dados atuais" icon={<Calendar size={20} />} />
      <div className="p-3 md:p-0">
        <DataTable caption="Holerites disponíveis" columns={columns} rows={linhas} rowKey={({ index }) => index} />
      </div>
    </Card>
  );
};

export default PayslipsTable;
