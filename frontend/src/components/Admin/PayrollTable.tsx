import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search, FileText, Download, SlidersHorizontal } from 'lucide-react';
import { EmployeePayroll, PayrollCompany, downloadPayslipPdf } from '../../services/payrollService';
import PayrollSlipModal from './PayrollSlipModal';
import PayrollEntriesModal from './PayrollEntriesModal';
import { useAuth } from '../../contexts/AuthContext';
import { rotuloDaCompetencia } from '../../utils/competencia';
import Card, { CardHeader } from '../ui/Card';
import Button, { IconButton } from '../ui/Button';
import Badge from '../ui/Badge';
import DataTable, { type Column } from '../ui/DataTable';
import Field, { Input } from '../ui/Field';
import { useToast } from '../ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';

// `locked` é a folha fechada: os lançamentos só se leem.
interface Props { payrolls: EmployeePayroll[]; competencia: string; empresa: PayrollCompany; locked: boolean; }

// Só uma página de linhas vai ao DOM: com milhares de colaboradores, desenhar todos trava a tela.
const PAGE_SIZE = 50;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCurrency = (val: number) => currency.format(val);

// Sem acento nem caixa, para a busca achar "Jose" em "José".
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const PayrollTable: React.FC<Props> = ({ payrolls, competencia, empresa, locked }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePayroll | null>(null);
  const [entriesOf, setEntriesOf] = useState<EmployeePayroll | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadPdf = async (emp: EmployeePayroll) => {
    setDownloading(emp.id);
    try {
      await downloadPayslipPdf(competencia, emp.id);
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Não foi possível gerar o PDF do holerite.'));
    } finally {
      setDownloading(null);
    }
  };

  // O campo responde na hora; o filtro sobre a lista inteira roda com prioridade menor e não
  // segura a digitação.
  const termo = useDeferredValue(searchTerm);
  const filtered = useMemo(() => {
    const procurado = normalizar(termo.trim());
    return procurado ? payrolls.filter(p => normalizar(p.name).includes(procurado)) : payrolls;
  }, [payrolls, termo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: Column<EmployeePayroll>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      semRotuloNoCartao: true,
      cell: (emp) => (
        <span className="block">
          <span className="block font-semibold text-ink">{emp.name}</span>
          <span className="block text-xs text-ink-muted">{emp.role}{emp.contract ? ` · ${emp.contract}` : ''}</span>
        </span>
      ),
    },
    { key: 'base', header: 'Salário Base', cell: (emp) => <span className="font-semibold text-ink-muted">{formatCurrency(emp.baseSalary)}</span> },
    { key: 'proventos', header: 'Proventos (+ extras)', cell: (emp) => <Badge tone="success" className="whitespace-nowrap">+ {formatCurrency(emp.totalEarnings)}</Badge> },
    { key: 'descontos', header: 'Descontos', cell: (emp) => <Badge tone="danger" className="whitespace-nowrap">- {formatCurrency(emp.totalDeductions)}</Badge> },
    { key: 'liquido', header: 'Líquido Final', align: 'right', cell: (emp) => <span className="text-lg font-bold text-ink">{formatCurrency(emp.netSalary)}</span> },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      semRotuloNoCartao: true,
      cell: (emp) => (
        <span className="flex items-center gap-2 md:justify-end">
          <IconButton label={`Ver holerite de ${emp.name}`} variant="secondary" size="sm" onClick={() => setSelectedEmployee(emp)}>
            <FileText size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label={`Baixar PDF do holerite de ${emp.name}`} variant="secondary" size="sm" onClick={() => downloadPdf(emp)} disabled={downloading !== null}>
            <Download size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label={`Lançamentos de ${emp.name}`} variant="secondary" size="sm" onClick={() => setEntriesOf(emp)}>
            <SlidersHorizontal size={16} aria-hidden="true" />
          </IconButton>
        </span>
      ),
    },
  ];

  return (
    <>
      <Card as="section" padding="none">
        <CardHeader
          title="Holerites Individuais"
          actions={(
            <div className="w-full sm:w-72">
              <Field label="Buscar colaborador" name="busca" hideLabel>
                <Input type="search" autoComplete="off" icon={<Search size={18} />} placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} />
              </Field>
            </div>
          )}
        />
        <div className="p-3 md:p-0">
          <DataTable
            caption="Holerites individuais da competência"
            columns={columns}
            rows={visible}
            rowKey={(emp) => emp.id}
            empty={<p className="py-12 text-center text-sm text-ink-muted">{payrolls.length === 0 ? 'Nenhum colaborador na folha deste mês.' : 'Nenhum colaborador encontrado.'}</p>}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4 text-sm text-ink-muted sm:px-6">
          <span>
            {filtered.length === 0
              ? 'Nenhum colaborador encontrado'
              : `Página ${currentPage} de ${totalPages} · ${filtered.length} colaboradores`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>Próxima</Button>
          </div>
        </div>
      </Card>

      {selectedEmployee && (
        <PayrollSlipModal
          isOpen
          onClose={() => setSelectedEmployee(null)}
          employee={selectedEmployee}
          month={rotuloDaCompetencia(competencia)}
          companyName={empresa.razaoSocial ?? user?.empresaNome}
          cnpj={empresa.cnpj}
          onDownloadPdf={() => downloadPdf(selectedEmployee)}
        />
      )}

      {entriesOf && (
        <PayrollEntriesModal
          competencia={competencia}
          mes={rotuloDaCompetencia(competencia)}
          employee={payrolls.find((emp) => emp.id === entriesOf.id) ?? entriesOf}
          locked={locked}
          onClose={() => setEntriesOf(null)}
        />
      )}
    </>
  );
};

export default PayrollTable;
