import React, { useState, useEffect, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { generateMonthlyPayroll, EmployeePayroll } from '../../services/payrollService';
import PayrollSummaryCards from '../../components/Admin/PayrollMetrics';
import PayrollTable from '../../components/Admin/PayrollTable';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

const Payroll: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allPayrolls, setAllPayrolls] = useState<EmployeePayroll[]>([]);
  
  const [deptFilter, setDeptFilter] = useState('Todos');

  const [reloadKey, setReloadKey] = useState(0);

  const startLoading = () => {
    setLoading(true);
    setLoadError(null);
  };

  const retry = () => {
    startLoading();
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    generateMonthlyPayroll()
      .then(setAllPayrolls)
      .catch((error) => {
        setAllPayrolls([]);
        setLoadError(mensagemDeErro(error, 'Erro ao processar folha de pagamento'));
      })
      .finally(() => setLoading(false));
  }, [reloadKey]);

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
          <p className="text-slate-500 font-medium mt-1">Visão financeira calculada com os dados atuais dos colaboradores.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
            <Filter size={16} className="text-slate-400" />
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer">
              <option value="Todos">Todos os Setores</option>
              {departmentsList.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>

        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold">Processando base de cálculo...</p>
        </div>
      ) : loadError ? (
        <ErrorAlert message={loadError} onRetry={retry} />
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