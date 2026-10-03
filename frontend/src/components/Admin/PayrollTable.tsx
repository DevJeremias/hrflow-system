import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';
import PayrollSlipModal from './PayrollSlipModal';
import { useAuth } from '../../contexts/AuthContext';
import { competenciaAtual } from '../../utils/competencia';

interface Props { payrolls: EmployeePayroll[]; }

// Só uma página de linhas vai ao DOM: com milhares de colaboradores, desenhar todos trava a tela.
const PAGE_SIZE = 50;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCurrency = (val: number) => currency.format(val);

// Sem acento nem caixa, para a busca achar "Jose" em "José".
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const PayrollTable: React.FC<Props> = ({ payrolls }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePayroll | null>(null);

  // O campo responde na hora; o filtro sobre a lista inteira roda com prioridade menor e não
  // segura a digitação.
  const termo = useDeferredValue(searchTerm);
  const filtered = useMemo(() => {
    const procurado = normalizar(termo.trim());
    return procurado ? payrolls.filter(p => normalizar(p.name).includes(procurado)) : payrolls;
  }, [payrolls, termo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500 delay-150">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-slate-800">Holerites Individuais</h3>
          <div className="relative w-64">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
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
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {visible.map((emp) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <span>
            {filtered.length === 0
              ? 'Nenhum colaborador encontrado'
              : `Página ${currentPage} de ${totalPages} · ${filtered.length} colaboradores`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}
              className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}
              className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50">Próxima</button>
          </div>
        </div>
      </div>

      <PayrollSlipModal 
        isOpen={!!selectedEmployee} 
        onClose={() => setSelectedEmployee(null)} 
        employee={selectedEmployee} 
        month={competenciaAtual()}
        companyName={user?.empresaNome}
      />
    </>
  );
};

export default PayrollTable;