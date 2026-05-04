import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Download, Filter } from 'lucide-react';
import { generateMonthlyPayroll, EmployeePayroll } from '../../services/payrollService';
import PayrollSummaryCards from './PayrollSummaryCards';
import PayrollTable from './PayrollTable';

const Payroll: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [allPayrolls, setAllPayrolls] = useState<EmployeePayroll[]>([]);
  
  const [deptFilter, setDeptFilter] = useState('Todos');
  const [monthFilter, setMonthFilter] = useState('2026-04'); 

  useEffect(() => {
    const loadPayrollData = async () => {
      setLoading(true);
      try {
        const data = await generateMonthlyPayroll();
        setAllPayrolls(data);
      } catch (error) {
        console.error("Erro ao processar folha:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPayrollData();
  }, [monthFilter]); 

  const displayedPayrolls = useMemo(() => {
    if (deptFilter === 'Todos') return allPayrolls;
    return allPayrolls.filter(p => p.department === deptFilter);
  }, [allPayrolls, deptFilter]);

  const dynamicMetrics = useMemo(() => {
    return displayedPayrolls.reduce((acc, curr) => ({
      gross: acc.gross + curr.totalGross,
      deductions: acc.deductions + curr.totalDeductions,
      net: acc.net + curr.netSalary,
      charges: acc.charges + curr.employerCharges
    }), { gross: 0, deductions: 0, net: 0, charges: 0 });
  }, [displayedPayrolls]);

  const departmentsList = Array.from(new Set(allPayrolls.map(p => p.department)));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Cabeçalho com Filtros de Alto Nível */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Folha</h1>
          <p className="text-slate-500 font-medium mt-1">Visão financeira e lançamentos do período.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
            <Filter size={16} className="text-slate-400" />
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer">
              <option value="Todos">Todos os Setores</option>
              {departmentsList.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>

          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} 
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold py-2.5 px-4 rounded-xl outline-none focus:border-primary cursor-pointer" />

          <button className="flex items-center gap-2 bg-slate-900 hover:bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95">
            <CheckCircle2 size={18} /><span>Fechar Mês</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold">Processando base de cálculo...</p>
        </div>
      ) : (
        <>
          <PayrollSummaryCards metrics={dynamicMetrics} />
          <PayrollTable payrolls={displayedPayrolls} />
        </>
      )}
    </div>
  );
};

export default Payroll;