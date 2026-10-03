import React, { useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';
import PayrollSlipModal from './PayrollSlipModal';
import { useAuth } from '../../contexts/AuthContext';
import { competenciaAtual } from '../../utils/competencia';
import Card, { CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import DataTable, { type Column } from '../ui/DataTable';
import Field, { Input } from '../ui/Field';

interface Props { payrolls: EmployeePayroll[]; }

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const PayrollTable: React.FC<Props> = ({ payrolls }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePayroll | null>(null);

  const filtered = payrolls.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const columns: Column<EmployeePayroll>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      semRotuloNoCartao: true,
      cell: (emp) => (
        <span className="block">
          <span className="block font-semibold text-ink">{emp.name}</span>
          <span className="block text-xs text-ink-muted">{emp.role}</span>
        </span>
      ),
    },
    { key: 'base', header: 'Salário Base', cell: (emp) => <span className="font-semibold text-ink-muted">{formatCurrency(emp.baseSalary)}</span> },
    { key: 'proventos', header: 'Proventos (+ extras)', cell: (emp) => <Badge tone="success">+ {formatCurrency(emp.totalEarnings)}</Badge> },
    { key: 'descontos', header: 'Descontos', cell: (emp) => <Badge tone="danger">- {formatCurrency(emp.totalDeductions)}</Badge> },
    { key: 'liquido', header: 'Líquido Final', align: 'right', cell: (emp) => <span className="text-lg font-bold text-ink">{formatCurrency(emp.netSalary)}</span> },
    {
      key: 'acoes',
      header: 'Holerite',
      align: 'right',
      semRotuloNoCartao: true,
      cell: (emp) => (
        <Button variant="secondary" size="sm" icon={<FileText size={16} aria-hidden="true" />} aria-label={`Ver holerite de ${emp.name}`} onClick={() => setSelectedEmployee(emp)}>
          Ver holerite
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card as="section" padding="none" >
        <CardHeader
          title="Holerites Individuais"
         
          actions={(
            <div className="w-full sm:w-72">
              <Field label="Buscar colaborador" name="busca" hideLabel>
                <Input type="search" autoComplete="off" icon={<Search size={18} />} placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </Field>
            </div>
          )}
        />
        <div className="p-3 md:p-0">
          <DataTable
            caption="Holerites individuais da competência"
            columns={columns}
            rows={filtered}
            rowKey={(emp) => emp.id}
            empty={<p className="py-12 text-center text-sm text-ink-muted">Nenhum colaborador encontrado.</p>}
          />
        </div>
      </Card>

      {selectedEmployee && (
        <PayrollSlipModal
          isOpen
          onClose={() => setSelectedEmployee(null)}
          employee={selectedEmployee}
          month={competenciaAtual()}
          companyName={user?.empresaNome}
        />
      )}
    </>
  );
};

export default PayrollTable;
