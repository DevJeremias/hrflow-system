import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../AuthContext';
import { EmployeePayroll, getMyPayroll } from '../../../services/payrollService';
import PayslipsSummaryCards from './PayslipsCards';
import PayslipsHistoryTable from './PayslipsHistory';
import HoleriteModal from '../../Admin/Payroll/HoleriteModal'; 
import { FileText } from 'lucide-react';

const MyPayslips: React.FC = () => {
  const { user } = useAuth();
  
  const [payslips, setPayslips] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<EmployeePayroll | null>(null);
  const [selectedMonthLabel, setSelectedMonthLabel] = useState('');

  const monthsLabels = ['Mês Atual'];

  useEffect(() => {
    const loadMyPayslips = async () => {
      setLoading(true);
      try {
        const data = await getMyPayroll();
        setPayslips(data);
      } catch (error) {
        console.error("Erro ao carregar holerite:", error);
      } finally {
        setLoading(false);
      }
    };
    loadMyPayslips();
  }, []);

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