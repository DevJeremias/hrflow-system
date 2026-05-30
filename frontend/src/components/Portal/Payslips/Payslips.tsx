import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../AuthContext';
import { EmployeePayroll } from '../../../services/payrollService';
import PayslipsSummaryCards from './PayslipsCards';
import PayslipsHistoryTable from './PayslipsHistory';
import HoleriteModal from '../../Admin/Payroll/HoleriteModal'; 

const MyPayslips: React.FC = () => {
  const { user } = useAuth();
  
  const [payslips, setPayslips] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<EmployeePayroll | null>(null);
  const [selectedMonthLabel, setSelectedMonthLabel] = useState('');

  useEffect(() => {
    const loadMyPayslips = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800)); 

      const mockData: EmployeePayroll[] = [
        {
          id: '1', name: user?.name || 'Colaborador', role: 'Desenvolvedor Fullstack', department: 'TI',
          baseSalary: 8500, totalEarnings: 500, totalGross: 9000, totalDeductions: 1085,
          netSalary: 7915, employerCharges: 2502,
          earningsList: [{ description: 'Auxílio Home Office', value: 500, isPercentage: false }],
          deductionsList: [
            { description: 'Plano de Saúde', value: 150, isPercentage: false },
            { description: 'INSS', value: 935, isPercentage: true }
          ]
        },
        {
          id: '1', name: user?.name || 'Colaborador', role: 'Desenvolvedor Fullstack', department: 'TI',
          baseSalary: 8500, totalEarnings: 1500, totalGross: 10000, totalDeductions: 1225,
          netSalary: 8775, employerCharges: 2780,
          earningsList: [
            { description: 'Auxílio Home Office', value: 500, isPercentage: false },
            { description: 'Bônus de Desempenho', value: 1000, isPercentage: false }
          ],
          deductionsList: [
            { description: 'Plano de Saúde', value: 150, isPercentage: false },
            { description: 'INSS', value: 1075, isPercentage: true }
          ]
        }
      ];

      setPayslips(mockData);
      setLoading(false);
    };

    loadMyPayslips();
  }, [user]);

  const handleOpenPayslip = (payroll: EmployeePayroll, monthLabel: string) => {
    setSelectedPayslip(payroll);
    setSelectedMonthLabel(monthLabel);
  };

  const monthsLabels = ['Março de 2026', 'Abril de 2026'];
  const latestPayslip = payslips[payslips.length - 1];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Meus Holerites</h1>
        <p className="text-slate-500 font-medium mt-1">Acesse e faça o download dos seus demonstrativos de pagamento.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold">Carregando demonstrativos...</p>
        </div>
      ) : (
        <>
          {/* Componente de Cards de Resumo */}
          {latestPayslip && (
            <PayslipsSummaryCards 
              latestPayslip={latestPayslip} 
              monthLabel={monthsLabels[monthsLabels.length - 1]} 
            />
          )}

          {/* Componente da Tabela Histórica */}
          <PayslipsHistoryTable 
            payslips={payslips} 
            monthsLabels={monthsLabels} 
            onOpenPayslip={handleOpenPayslip} 
          />
        </>
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