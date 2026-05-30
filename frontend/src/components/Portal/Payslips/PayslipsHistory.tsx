import React from 'react';
import { FileText, Eye, Calendar } from 'lucide-react';
import { EmployeePayroll } from '../../../services/payrollService';

interface Props {
  payslips: EmployeePayroll[];
  monthsLabels: string[];
  onOpenPayslip: (payroll: EmployeePayroll, monthLabel: string) => void;
}

const PayslipsHistory: React.FC<Props> = ({ payslips, monthsLabels, onOpenPayslip }) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
      
      {/* Cabeçalho da Tabela */}
      <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
        <div className="p-2.5 bg-indigo-50 text-primary rounded-xl">
          <Calendar size={20} />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Recebimento</h2>
      </div>

      {/* Corpo da Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-white text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-100">
              <th className="p-6">Mês de Referência</th>
              <th className="p-6 text-center">Salário Bruto</th>
              <th className="p-6 text-center">Descontos</th>
              <th className="p-6 text-center">Valor Líquido</th>
              <th className="p-6 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium">
            {payslips.map((payroll, idx) => {
              const monthLabel = monthsLabels[idx] || 'Mês Anterior';
              return (
                <tr key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group">
                  
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-primary rounded-lg">
                        <FileText size={16} />
                      </div>
                      <span className="font-bold text-slate-900">{monthLabel}</span>
                    </div>
                  </td>
                  
                  <td className="p-6 text-center text-slate-600">
                    {formatCurrency(payroll.totalGross)}
                  </td>
                  
                  <td className="p-6 text-center text-rose-500">
                    - {formatCurrency(payroll.totalDeductions)}
                  </td>
                  
                  <td className="p-6 text-center font-black text-slate-900">
                    {formatCurrency(payroll.netSalary)}
                  </td>
                  
                  <td className="p-6 text-right">
                    <button
                      onClick={() => onOpenPayslip(payroll, monthLabel)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-primary text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <Eye size={14} /> Visualizar
                    </button>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayslipsHistory;