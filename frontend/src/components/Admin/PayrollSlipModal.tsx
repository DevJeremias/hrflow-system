import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Building } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';
import { mascararCnpj } from '../../utils/empresa';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeePayroll | null;
  month: string;
  companyName?: string;
  // Só os dígitos, como a API os guarda; sem CNPJ a linha não aparece.
  cnpj?: string | null;
}

interface Linha { descricao: string; referencia: string; tipo: 'vencimento' | 'desconto'; valor: number; }

const PayrollSlipModal: React.FC<Props> = ({ isOpen, onClose, employee, month, companyName, cnpj }) => {
  if (!isOpen || !employee) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Abaixo de sm as linhas viram uma lista empilhada; a tabela de quatro colunas só cabe a partir daí.
  const linhas: Linha[] = [
    { descricao: 'Salário Base', referencia: '30 dias', tipo: 'vencimento', valor: employee.baseSalary },
    ...employee.earningsList.map((item): Linha => ({ descricao: item.description, referencia: '---', tipo: 'vencimento', valor: item.value })),
    ...employee.deductionsList.map((item): Linha => ({ descricao: item.description, referencia: '---', tipo: 'desconto', valor: item.value })),
  ];

  // Portal em <body>: o @media print esconde o resto da aplicação sem deixar páginas em branco.
  return createPortal(
    <div className="holerite-impressao fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:block print:p-0" role="dialog" aria-modal="true" aria-labelledby="holerite-titulo">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 print:hidden" onClick={onClose} />
      
      <div className="bg-white w-full max-w-3xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:max-w-none print:shadow-none print:rounded-none animate-in zoom-in-95 duration-300">
        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden">
          <h2 id="holerite-titulo" className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Detalhes do Holerite</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="p-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-2xl transition-all shadow-sm" title="Imprimir Holerite">
              <Printer size={20} />
            </button>
            <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 print:p-0 print:overflow-visible custom-scrollbar bg-slate-50 print:bg-white">
          <div className="bg-white border-2 border-slate-200 print:border-slate-900 rounded-2xl print:rounded-none overflow-hidden print:border-2">
            
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center p-4 sm:p-6 border-b-2 border-slate-200 print:border-slate-900">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 shrink-0 bg-slate-900 text-white rounded-xl flex items-center justify-center print:border print:border-slate-900 print:bg-white print:text-slate-900">
                  <Building size={24} />
                </div>
                <div className="min-w-0">
                  {companyName && <h1 className="font-black text-lg text-slate-900 uppercase tracking-tight break-words min-w-0">{companyName}</h1>}
                  {cnpj && <p className="text-sm font-bold text-slate-500">CNPJ: {mascararCnpj(cnpj)}</p>}
                </div>
              </div>
              <div className="sm:text-right">
                <h2 className="font-black text-xl text-slate-900 uppercase">Recibo de Pagamento</h2>
                <p className="text-sm font-bold text-slate-500">Referência: {month}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 sm:p-6 border-b-2 border-slate-200 print:border-slate-900 bg-slate-50/50 print:bg-white">
              <div className="col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Código / Nome do Funcionário</p>
                <p className="font-bold text-slate-900 break-words">{employee.id.padStart(4, '0')} - {employee.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Setor</p>
                <p className="font-bold text-slate-900 break-words">{employee.department}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cargo</p>
                <p className="font-bold text-slate-900 break-words">{employee.role}</p>
              </div>
            </div>

            <ul className="sm:hidden print:hidden divide-y divide-dashed divide-slate-200 px-4">
              {linhas.map((linha, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 break-words">{linha.descricao}</p>
                    {linha.referencia !== '---' && <p className="text-xs text-slate-400">{linha.referencia}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{linha.tipo === 'vencimento' ? 'Vencimento' : 'Desconto'}</p>
                    <p className={`font-bold ${linha.tipo === 'vencimento' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(linha.valor)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block print:block overflow-x-auto">
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
                  {linhas.map((linha, idx) => (
                    <tr key={idx} className="border-b border-slate-100 border-dashed">
                      <td className="p-4">{linha.descricao}</td>
                      <td className="p-4 text-center">{linha.referencia}</td>
                      <td className="p-4 text-right font-bold text-slate-900">{linha.tipo === 'vencimento' && formatCurrency(linha.valor)}</td>
                      <td className="p-4 text-right font-bold text-slate-900">{linha.tipo === 'desconto' && formatCurrency(linha.valor)}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={4} className="h-32 print:h-16"></td></tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 border-t-2 border-slate-200 print:border-slate-900">
              <div className="order-2 sm:order-1 print:order-1 p-4 sm:p-6 border-t-2 sm:border-t-0 sm:border-r-2 print:border-t-0 print:border-r-2 border-slate-200 print:border-slate-900 flex flex-col justify-end">
                <p className="text-xs font-medium text-slate-500 mb-6">Declaro ter recebido a importância líquida discriminada neste recibo.</p>
                <div className="border-t border-slate-400 pt-2 text-center text-xs font-bold text-slate-600 uppercase tracking-widest mt-8">
                  Assinatura do Funcionário
                </div>
              </div>
              <div className="order-1 sm:order-2 print:order-2 bg-slate-50/50 print:bg-white">
                <div className="flex justify-between gap-3 p-4 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Vencimentos</span>
                  <span className="font-bold text-slate-900">{formatCurrency(employee.totalGross)}</span>
                </div>
                <div className="flex justify-between gap-3 p-4 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Descontos</span>
                  <span className="font-bold text-slate-900">{formatCurrency(employee.totalDeductions)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-6 bg-slate-900 print:bg-white text-white print:text-slate-900">
                  <span className="text-xs font-black uppercase tracking-widest">Valor Líquido →</span>
                  <span className="text-xl sm:text-2xl font-black">{formatCurrency(employee.netSalary)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body > *:not(.holerite-impressao) { display: none !important; }
          .holerite-impressao { position: static; inset: auto; display: block; padding: 0; background: transparent; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default PayrollSlipModal;