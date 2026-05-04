import React from 'react';
import { Wallet, TrendingDown, Landmark, Building } from 'lucide-react';

interface Props {
  metrics: { gross: number; deductions: number; net: number; charges: number };
}

const PayrollSummaryCards: React.FC<Props> = ({ metrics }) => {
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 mb-4 transition-transform group-hover:scale-110"><Landmark size={24} /></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Bruto (Salários)</p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(metrics.gross)}</h3>
      </div>

      <div className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 flex flex-col justify-center relative overflow-hidden group">
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-amber-500 mb-4 transition-transform group-hover:scale-110 shadow-sm"><Building size={24} /></div>
        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Encargos Empresa (Estimado)</p>
        <h3 className="text-2xl font-black text-amber-900 tracking-tight">{formatCurrency(metrics.charges)}</h3>
      </div>

      <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 flex flex-col justify-center relative overflow-hidden group">
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-rose-500 mb-4 transition-transform group-hover:scale-110 shadow-sm"><TrendingDown size={24} /></div>
        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Retenções (INSS/IRRF)</p>
        <h3 className="text-2xl font-black text-rose-900 tracking-tight">{formatCurrency(metrics.deductions)}</h3>
      </div>

      <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl flex flex-col justify-center relative overflow-hidden group">
        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-400 mb-4 transition-transform group-hover:scale-110 border border-white/10"><Wallet size={24} /></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Líquido a Pagar (Folha)</p>
        <h3 className="text-2xl font-black text-white tracking-tight">{formatCurrency(metrics.net)}</h3>
      </div>

    </div>
  );
};

export default PayrollSummaryCards;