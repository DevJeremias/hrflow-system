import React, { useState, useEffect, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { generateMonthlyPayroll, EmployeePayroll } from '../../services/payrollService';
import PayrollSummaryCards from '../../components/Admin/PayrollMetrics';
import PayrollTable from '../../components/Admin/PayrollTable';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import Field, { Select } from '../../components/ui/Field';
import { mensagemDeErro } from '../../utils/erros';
import { usePageTitle } from '../../hooks/usePageTitle';

const Payroll: React.FC = () => {
  usePageTitle('Folha de pagamento');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allPayrolls, setAllPayrolls] = useState<EmployeePayroll[]>([]);

  const [deptFilter, setDeptFilter] = useState('Todos');

  const [reloadKey, setReloadKey] = useState(0);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
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
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Gestão de Folha"
        description="Visão financeira calculada com os dados atuais dos colaboradores."
        actions={(
          <div className="flex items-end gap-2">
            <Filter size={18} aria-hidden="true" className="mb-3 text-ink-subtle" />
            <Field label="Setor" name="setor">
              <Select autoComplete="off" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="Todos">Todos os Setores</option>
                {departmentsList.map(dept => <option key={dept} value={dept}>{dept}</option>)}
              </Select>
            </Field>
          </div>
        )}
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
          <Spinner size="lg" rotulo="Processando base de cálculo" />
          <p className="font-semibold">Processando base de cálculo...</p>
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
