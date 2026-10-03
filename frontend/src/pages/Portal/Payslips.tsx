import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { EmployeePayroll, getMyPayroll } from '../../services/payrollService';
import PayslipsSummaryCards from '../../components/Portal/PayslipsMetrics';
import PayslipsHistoryTable from '../../components/Portal/PayslipsTable';
import HoleriteModal from '../../components/Admin/PayrollSlipModal';
import ErrorAlert from '../../components/ErrorAlert';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import { mensagemDeErro } from '../../utils/erros';
import { competenciaAtual } from '../../utils/competencia';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

const MyPayslips: React.FC = () => {
  usePageTitle('Meus holerites');
  const [payslips, setPayslips] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<EmployeePayroll | null>(null);
  const [selectedMonthLabel, setSelectedMonthLabel] = useState('');

  const { user } = useAuth();
  const monthsLabels = [competenciaAtual()];

  const [reloadKey, setReloadKey] = useState(0);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    getMyPayroll()
      .then(setPayslips)
      .catch((error) => setLoadError(mensagemDeErro(error, 'Erro ao buscar meu holerite')))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  const handleOpenPayslip = (payroll: EmployeePayroll, monthLabel: string) => {
    setSelectedPayslip(payroll);
    setSelectedMonthLabel(monthLabel);
  };

  const latestPayslip = payslips[payslips.length - 1];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Meus Holerites" description="Acesse e faça o download dos seus demonstrativos de pagamento." />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-ink-muted">
          <Spinner size="lg" rotulo="Carregando demonstrativos..." />
          <p className="font-semibold" aria-hidden="true">Carregando demonstrativos...</p>
        </div>
      ) : loadError ? (
        <ErrorAlert message={loadError} onRetry={retry} />
      ) : payslips.length > 0 ? (
        <>
          {latestPayslip && (
            <PayslipsSummaryCards
              latestPayslip={latestPayslip}
              monthLabel={monthsLabels[monthsLabels.length - 1]}
            />
          )}

          <PayslipsHistoryTable
            payslips={payslips}
            monthsLabels={monthsLabels}
            onOpenPayslip={handleOpenPayslip}
          />
        </>
      ) : (
        <EmptyState
          icon={<FileText size={32} />}
          title="Nenhum holerite disponível"
          description="O seu primeiro recibo de vencimento aparecerá aqui após o processamento da folha."
          className="rounded-card border border-line bg-surface shadow-card"
        />
      )}

      {selectedPayslip && (
        <HoleriteModal
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          employee={selectedPayslip}
          month={selectedMonthLabel}
          companyName={user?.empresaNome}
        />
      )}
    </div>
  );
};

export default MyPayslips;
