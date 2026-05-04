import React from 'react';
import { X, Printer, Mail, Building } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeePayroll | null;
  month: string; // Ex: "abril de 2026"
}

const HoleriteModal: React.FC<Props> = ({ isOpen, onClose, employee, month }) => {
  if (!isOpen || !employee) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 print:hidden" onClick={onClose} />
      
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:rounded-none print:h-screen animate-in zoom-in-95 duration-300">
        
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Detalhes do Holerite</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="p-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-2xl transition-all shadow-sm" title="Imprimir Holerite">
              <Printer size={20} />
            </button>
            <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-12 print:p-0 custom-scrollbar bg-slate-50 print:bg-white">
          
          <div className="bg-white border-2 border-slate-200 print:border-slate-900 rounded-2xl print:rounded-none overflow-hidden print:border-2">
            
            <div className="flex justify-between items-center p-6 border-b-2 border-slate-200 print:border-slate-900">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center print:border print:border-slate-900 print:bg-white print:text-slate-900">
                  <Building size={24} />
                </div>
                <div>
                  <h1 className="font-black text-lg text-slate-900 uppercase tracking-tight">Sua Empresa S/A</h1>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">CNPJ: 00.000.000/0001-00</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="font-black text-xl text-slate-900 uppercase">Recibo de Pagamento</h2>
                <p className="text-sm font-bold text-slate-500 capitalize">Referência: {month}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 p-6 border-b-2 border-slate-200 print:border-slate-900 bg-slate-50/50 print:bg-white">
              <div className="col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Código / Nome do Funcionário</p>
                <p className="font-bold text-slate-900">{employee.id.padStart(4, '0')} - {employee.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Setor</p>
                <p className="font-bold text-slate-900">{employee.department}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cargo</p>
                <p className="font-bold text-slate-900">{employee.role}</p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 print:border-slate-900 bg-slate-50/50 print:bg-white text-[10px] uppercase tracking-widest text-slate-500 font-black">
                  <th className="text-left p-4 w-1/2">Descrição</th>
                  <th className="text-center p-4">Referência</th>
                  <th className="text-right p-4 text-emerald-600">Vencimentos</th>
                  <th className="text-right p-4 text-rose-600">Descontos</th>
                </tr>
              </thead>
              <tbody className="font-medium text-slate-700 align-top">
                <tr className="border-b border-slate-100 border-dashed">
                  <td className="p-4">Salário Base</td>
                  <td className="p-4 text-center">30 dias</td>
                  <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(employee.baseSalary)}</td>
                  <td className="p-4 text-right"></td>
                </tr>

                {employee.earningsList.map((item, idx) => (
                  <tr key={`earn-${idx}`} className="border-b border-slate-100 border-dashed">
                    <td className="p-4">{item.description}</td>
                    <td className="p-4 text-center">{item.isPercentage ? '---' : '---'}</td>
                    <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(item.value)}</td>
                    <td className="p-4 text-right"></td>
                  </tr>
                ))}

                {employee.deductionsList.map((item, idx) => (
                  <tr key={`deduc-${idx}`} className="border-b border-slate-100 border-dashed">
                    <td className="p-4">{item.description}</td>
                    <td className="p-4 text-center">{item.isPercentage ? '---' : '---'}</td>
                    <td className="p-4 text-right"></td>
                    <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(item.value)}</td>
                  </tr>
                ))}
                
                <tr><td colSpan={4} className="h-32"></td></tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 border-t-2 border-slate-200 print:border-slate-900">
              <div className="p-6 border-r-2 border-slate-200 print:border-slate-900 flex flex-col justify-end">
                <p className="text-xs font-medium text-slate-500 mb-6">Declaro ter recebido a importância líquida discriminada neste recibo.</p>
                <div className="border-t border-slate-400 pt-2 text-center text-xs font-bold text-slate-600 uppercase tracking-widest mt-8">
                  Assinatura do Funcionário
                </div>
              </div>

              <div className="bg-slate-50/50 print:bg-white">
                <div className="flex justify-between p-4 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Vencimentos</span>
                  <span className="font-bold text-slate-900">{formatCurrency(employee.totalGross)}</span>
                </div>
                <div className="flex justify-between p-4 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Descontos</span>
                  <span className="font-bold text-slate-900">{formatCurrency(employee.totalDeductions)}</span>
                </div>
                <div className="flex justify-between p-6 bg-slate-900 print:bg-white text-white print:text-slate-900">
                  <span className="text-xs font-black uppercase tracking-widest">Valor Líquido →</span>
                  <span className="text-2xl font-black">{formatCurrency(employee.netSalary)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .fixed.inset-0.z-50, .fixed.inset-0.z-50 * { visibility: visible; }
          .fixed.inset-0.z-50 { position: absolute; left: 0; top: 0; padding: 0; margin: 0; background: transparent; }
        }
      `}</style>
    </div>
  );
};

export default HoleriteModal;