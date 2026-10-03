import React from 'react';
import { DollarSign, TrendingDown, Wallet } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';
import StatCard from '../ui/StatCard';

interface Props {
  latestPayslip: EmployeePayroll;
  monthLabel: string;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const PayslipsMetrics: React.FC<Props> = ({ latestPayslip, monthLabel }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
    <StatCard label={`Último bruto (${monthLabel})`} value={formatCurrency(latestPayslip.totalGross)} icon={<DollarSign size={24} />} />
    <StatCard label="Total descontado" value={<span className="text-danger">{formatCurrency(latestPayslip.totalDeductions)}</span>} icon={<TrendingDown size={24} />} tone="danger" />
    <StatCard label="Líquido recebido" value={formatCurrency(latestPayslip.netSalary)} icon={<Wallet size={24} />} tone="inverse" />
  </div>
);

export default PayslipsMetrics;
