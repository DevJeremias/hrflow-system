import React from 'react';
import { Wallet, TrendingDown, Landmark, Building } from 'lucide-react';
import StatCard from '../ui/StatCard';

interface Props {
  // `retentions` é o que a empresa retém e recolhe: INSS e IRRF, sem os descontos de benefício.
  metrics: { gross: number; retentions: number; net: number; charges: number };
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const PayrollMetrics: React.FC<Props> = ({ metrics }) => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
    <StatCard label="Custo Bruto (Salários)" value={formatCurrency(metrics.gross)} icon={<Landmark size={24} />} />
    <StatCard label="Encargos Empresa (FGTS e patronais)" value={formatCurrency(metrics.charges)} icon={<Building size={24} />} tone="warning" />
    <StatCard label="Retenções (INSS/IRRF)" value={formatCurrency(metrics.retentions)} icon={<TrendingDown size={24} />} tone="danger" />
    <StatCard label="Líquido a Pagar (Folha)" value={formatCurrency(metrics.net)} icon={<Wallet size={24} />} tone="inverse" />
  </div>
);

export default PayrollMetrics;
