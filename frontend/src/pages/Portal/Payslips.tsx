import React, { useState, useEffect } from 'react';
import { EmployeePayroll, getMyPayroll } from '../../services/payrollService';
import PayslipsSummaryCards from '../../components/Portal/PayslipsMetrics';
import PayslipsHistoryTable from '../../components/Portal/PayslipsTable';
import HoleriteModal from '../../components/Admin/PayrollSlipModal'; 
import { FileText } from 'lucide-react';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

const MyPayslips: React.FC = () => {
  const [payslips, setPayslips] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<EmployeePayroll | null>(null);
  const [selectedMonthLabel, setSelectedMonthLabel] = useState('');

  const monthsLabels = ['Mês Atual'];

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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Meus Holerites</h1>
        <p className="text-slate-500 font-medium mt-1">Acesse e faça o download dos seus demonstrativos de pagamento.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold">A carregar demonstrativos...</p>
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
        <div className="py-20 text-center flex flex-col items-center gap-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
            <FileText size={32} />
          </div>
          <div>
            <p className="text-slate-600 font-bold text-lg">Nenhum holerite disponível</p>
            <p className="text-slate-400 font-medium text-sm">O seu primeiro recibo de vencimento aparecerá aqui após o processamento da folha.</p>
          </div>
        </div>
      )}

      {selectedPayslip && (
        <HoleriteModal 
          isOpen={!!selectedPayslip} 
          onClose={() => setSelectedPayslip(null)} 
          employee={selectedPayslip} 
          month={selectedMonthLabel} 
        />
      )}
    </div>
  );
};

export default MyPayslips;