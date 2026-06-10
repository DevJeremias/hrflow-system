import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../AuthContext';
import { EmployeePayroll, getMyPayroll } from '../../../services/payrollService';
import PayslipsSummaryCards from './PayslipsCards';
import PayslipsHistoryTable from './PayslipsHistory';
import HoleriteModal from '../../Admin/Payroll/HoleriteModal'; 

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
        <div className="py-20 text-center text-slate-500 font-bold">
          Nenhum holerite processado até ao momento.
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