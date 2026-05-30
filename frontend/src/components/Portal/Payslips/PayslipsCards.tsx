import React from 'react';
import { DollarSign, TrendingDown, Wallet } from 'lucide-react';
import { EmployeePayroll } from '../../../services/payrollService';

interface Props {
  latestPayslip: EmployeePayroll;
  monthLabel: string;
}

const PayslipsCards: React.FC<Props> = ({ latestPayslip, monthLabel }) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-4">
          <DollarSign size={24} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          Último Bruto ({monthLabel})
        </p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">
          {formatCurrency(latestPayslip.totalGross)}
        </h3>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 mb-4 flex items-center justify-center">
          <TrendingDown size={24} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          Total Descontado
        </p>
        <h3 className="text-2xl font-black text-rose-600 tracking-tight">
          {formatCurrency(latestPayslip.totalDeductions)}
        </h3>
      </div>

      <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl flex flex-col justify-center">
        <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-400 mb-4 flex items-center justify-center border border-white/10">
          <Wallet size={24} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          Líquido Recebido
        </p>
        <h3 className="text-2xl font-black text-white tracking-tight">
          {formatCurrency(latestPayslip.netSalary)}
        </h3>
      </div>

    </div>
  );
};

export default PayslipsCards;