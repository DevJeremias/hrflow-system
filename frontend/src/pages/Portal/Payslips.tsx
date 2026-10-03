import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import type { Payslip } from '../../services/payrollService';
import { useMeusHolerites } from '../../queries/folha';
import PayslipsSummaryCards from '../../components/Portal/PayslipsMetrics';
import PayslipsHistoryTable from '../../components/Portal/PayslipsTable';
import HoleriteModal from '../../components/Admin/PayrollSlipModal';
import ErrorAlert from '../../components/ErrorAlert';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import { mensagemDeErro } from '../../utils/erros';
import { rotuloDaCompetencia } from '../../utils/competencia';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

const MyPayslips: React.FC = () => {
  usePageTitle('Meus holerites');
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const { user } = useAuth();

  const { data, error, isPending, refetch } = useMeusHolerites();
  const payslips = data ?? [];
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar meu holerite') : null;

  // A API entrega do mês mais recente ao mais antigo.
  const latestPayslip = payslips[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Meus Holerites" description="Os recibos de cada mês, disponíveis depois que o RH fecha a folha." />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-ink-muted">
          <Spinner size="lg" rotulo="Carregando demonstrativos..." />
          <p className="font-semibold" aria-hidden="true">Carregando demonstrativos...</p>
        </div>
      ) : loadError ? (
        <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />
      ) : payslips.length > 0 ? (
        <>
          {latestPayslip && (
            <PayslipsSummaryCards
              latestPayslip={latestPayslip}
              monthLabel={rotuloDaCompetencia(latestPayslip.competencia)}
            />
          )}

          <PayslipsHistoryTable
            payslips={payslips}
            onOpenPayslip={setSelectedPayslip}
          />
        </>
      ) : (
        <EmptyState
          icon={<FileText size={32} />}
          title="Nenhum holerite disponível"
          description="O seu primeiro recibo de vencimento aparecerá aqui quando o RH fechar a folha do mês."
          className="rounded-card border border-line bg-surface shadow-card"
        />
      )}

      {selectedPayslip && (
        <HoleriteModal
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          employee={selectedPayslip}
          month={rotuloDaCompetencia(selectedPayslip.competencia)}
          companyName={selectedPayslip.empresa.razaoSocial ?? user?.empresaNome}
          cnpj={selectedPayslip.empresa.cnpj}
        />
      )}
    </div>
  );
};

export default MyPayslips;
