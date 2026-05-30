// src/services/payslipService.ts

// 1. Interfaces completas baseadas no modelo Web[cite: 6]
export interface PayrollItem {
  description: string;
  value: number;
  isPercentage: boolean;
}

export interface EmployeePayroll {
  id: string;
  monthLabel: string; // Adaptado para incluir o mês direto no objeto para facilitar
  name: string;
  role: string;
  department: string;
  baseSalary: number;
  totalEarnings: number;
  totalGross: number;
  totalDeductions: number;
  netSalary: number;
  employerCharges: number;
  earningsList: PayrollItem[];
  deductionsList: PayrollItem[];
}

export const payslipService = {
  
  // 2. Mock com os dados completos do seu backend[cite: 6]
  async getMyPayslips(): Promise<EmployeePayroll[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '2', monthLabel: 'Abril de 2026', name: 'Marcos Brigida', role: 'Desenvolvedor Fullstack', department: 'TI',
            baseSalary: 8500, totalEarnings: 1500, totalGross: 10000, totalDeductions: 1225,
            netSalary: 8775, employerCharges: 2780,
            earningsList: [
              { description: 'Salário Base', value: 8500, isPercentage: false },
              { description: 'Auxílio Home Office', value: 500, isPercentage: false },
              { description: 'Bônus de Desempenho', value: 1000, isPercentage: false }
            ],
            deductionsList: [
              { description: 'Plano de Saúde', value: 150, isPercentage: false },
              { description: 'INSS', value: 1075, isPercentage: true }
            ]
          },
          {
            id: '1', monthLabel: 'Março de 2026', name: 'Marcos Brigida', role: 'Desenvolvedor Fullstack', department: 'TI',
            baseSalary: 8500, totalEarnings: 500, totalGross: 9000, totalDeductions: 1085,
            netSalary: 7915, employerCharges: 2502,
            earningsList: [
              { description: 'Salário Base', value: 8500, isPercentage: false },
              { description: 'Auxílio Home Office', value: 500, isPercentage: false }
            ],
            deductionsList: [
              { description: 'Plano de Saúde', value: 150, isPercentage: false },
              { description: 'INSS', value: 935, isPercentage: true }
            ]
          }
        ]);
      }, 800);
    });
  },

  // 3. Função que gera o Recibo de Pagamento (Holerite) em PDF detalhado
  generateHoleritePDF(payroll: EmployeePayroll): string {
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const earningsRows = payroll.earningsList.map(item => `
      <tr>
        <td>${item.description}</td>
        <td style="text-align: right; color: #059669;">${formatCurrency(item.value)}</td>
        <td style="text-align: right;">-</td>
      </tr>
    `).join('');

    const deductionsRows = payroll.deductionsList.map(item => `
      <tr>
        <td>${item.description}</td>
        <td style="text-align: right;">-</td>
        <td style="text-align: right; color: #e11d48;">${formatCurrency(item.value)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
          .header { border-bottom: 2px solid #ea580c; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 24px; font-weight: bold; }
          .emp-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; text-transform: uppercase; font-size: 12px; }
          .totals { background: #f8fafc; font-weight: bold; }
          .net-salary { font-size: 18px; text-align: right; margin-top: 20px; padding: 15px; background: #0f172a; color: white; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Recibo de Pagamento de Salário</div>
          <div>Referência: <strong>${payroll.monthLabel}</strong></div>
        </div>
        
        <div class="emp-info">
          <strong>Colaborador:</strong> ${payroll.name}<br>
          <strong>Cargo:</strong> ${payroll.role} | <strong>Departamento:</strong> ${payroll.department}
        </div>

        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th style="text-align: right;">Vencimentos</th>
              <th style="text-align: right;">Descontos</th>
            </tr>
          </thead>
          <tbody>
            ${earningsRows}
            ${deductionsRows}
            <tr class="totals">
              <td><strong>Total</strong></td>
              <td style="text-align: right; color: #059669;">${formatCurrency(payroll.totalGross)}</td>
              <td style="text-align: right; color: #e11d48;">${formatCurrency(payroll.totalDeductions)}</td>
            </tr>
          </tbody>
        </table>

        <div class="net-salary">
          Líquido a Receber: <span style="color: #34d399;">${formatCurrency(payroll.netSalary)}</span>
        </div>
      </body>
      </html>
    `;
  }
};