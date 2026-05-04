import React, { useState } from 'react';
import { Search, PlusCircle } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';
import HoleriteModal from './HoleriteModal'; 

interface Props { payrolls: EmployeePayroll[]; }

const PayrollTable: React.FC<Props> = ({ payrolls }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePayroll | null>(null);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const filtered = payrolls.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500 delay-150">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-slate-800">Holerites Individuais</h3>
          <div className="relative w-64">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-medium" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-black">
                <th className="p-6 border-b border-slate-100">Colaborador</th>
                <th className="p-6 border-b border-slate-100">Salário Base</th>
                <th className="p-6 border-b border-slate-100">Proventos (+ extras)</th>
                <th className="p-6 border-b border-slate-100">Descontos</th>
                <th className="p-6 border-b border-slate-100 text-right">Líquido Final</th>
                <th className="p-6 border-b border-slate-100 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {filtered.map((emp) => (
                <tr 
                  key={emp.id} 
                  onClick={() => setSelectedEmployee(emp)}
                  className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 group cursor-pointer"
                >
                  <td className="p-6"><div className="font-bold text-slate-900">{emp.name}</div><div className="text-xs text-slate-500">{emp.role}</div></td>
                  <td className="p-6 text-slate-600 font-bold">{formatCurrency(emp.baseSalary)}</td>
                  <td className="p-6"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">+ {formatCurrency(emp.totalEarnings)}</span></td>
                  <td className="p-6"><span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-100">- {formatCurrency(emp.totalDeductions)}</span></td>
                  <td className="p-6 text-right"><span className="text-lg font-black text-slate-900">{formatCurrency(emp.netSalary)}</span></td>
                  <td className="p-6 text-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); 
                        alert('Aqui abriremos o modal de Lançamento Avulso no futuro!');
                      }}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center mx-auto" 
                      title="Adicionar Lançamento Avulso"
                    >
                      <PlusCircle size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <HoleriteModal 
        isOpen={!!selectedEmployee} 
        onClose={() => setSelectedEmployee(null)} 
        employee={selectedEmployee} 
        month="Abril de 2026" 
      />
    </>
  );
};

export default PayrollTable;