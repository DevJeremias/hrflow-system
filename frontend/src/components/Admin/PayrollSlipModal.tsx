import React from 'react';
import { Printer, Building, Download } from 'lucide-react';
import { EmployeePayroll } from '../../services/payrollService';
import Modal from '../ui/Modal';
import { IconButton } from '../ui/Button';
import { mascararCnpj } from '../../utils/empresa';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeePayroll | null;
  month: string;
  companyName?: string;
  // Só os dígitos, como a API os guarda; sem CNPJ a linha não aparece.
  cnpj?: string | null;
  // Sem esta função o botão de PDF não aparece.
  onDownloadPdf?: () => void;
}

interface Linha { descricao: string; referencia: string; tipo: 'vencimento' | 'desconto'; valor: number; }

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const ROTULO = 'text-xs font-semibold uppercase tracking-wider text-ink-muted';

const PayrollSlipModal: React.FC<Props> = ({ isOpen, onClose, employee, month, companyName, cnpj, onDownloadPdf }) => {
  if (!isOpen || !employee) return null;

  // Abaixo de sm as linhas viram uma lista empilhada; a tabela de quatro colunas só cabe a partir daí.
  const linhas: Linha[] = [
    { descricao: 'Salário Base', referencia: '30 dias', tipo: 'vencimento', valor: employee.baseSalary },
    ...employee.earningsList.map((item): Linha => ({ descricao: item.description, referencia: item.reference ?? '---', tipo: 'vencimento', valor: item.value })),
    ...employee.deductionsList.map((item): Linha => ({ descricao: item.description, referencia: item.reference ?? '---', tipo: 'desconto', valor: item.value })),
  ];

  // Bases de cálculo e FGTS: informativos, não entram nos totais. Os holerites emitidos antes do IRRF não têm bases.
  const informativos = employee.bases
    ? [
      ['Base INSS', formatCurrency(employee.bases.inss)],
      ['Base FGTS', formatCurrency(employee.bases.fgts)],
      ['FGTS do mês', formatCurrency(employee.fgts)],
      ['Base IRRF', formatCurrency(employee.bases.irrf)],
      ['Dependentes IRRF', String(employee.dependents)],
    ]
    : [];

  // O contêiner do modal fica no <body>: o @media print esconde o resto da aplicação sem deixar páginas em branco.
  return (
    <Modal
      title="Detalhes do Holerite"
      size="lg"
      onClose={onClose}
      portalClassName="holerite-impressao"
      bodyClassName="bg-surface-muted p-4 sm:p-8 print:bg-white print:p-0"
      headerActions={(
        <span className="flex items-center gap-2">
          {onDownloadPdf && (
            <IconButton label="Baixar PDF" variant="secondary" onClick={onDownloadPdf}>
              <Download size={20} aria-hidden="true" />
            </IconButton>
          )}
          <IconButton label="Imprimir Holerite" variant="secondary" onClick={() => window.print()}>
            <Printer size={20} aria-hidden="true" />
          </IconButton>
        </span>
      )}
    >
      <div className="overflow-hidden rounded-card border-2 border-line bg-surface print:rounded-none print:border-2 print:border-ink">
        <div className="flex flex-col items-start gap-4 border-b-2 border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 print:border-ink">
          <div className="flex min-w-0 items-center gap-4">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-ink text-white print:border print:border-ink print:bg-white print:text-ink">
              <Building size={24} />
            </span>
            <div className="min-w-0">
              {companyName && <p className="break-words text-lg font-bold uppercase tracking-tight text-ink">{companyName}</p>}
              {cnpj && <p className="text-sm font-semibold text-ink-muted">CNPJ: {mascararCnpj(cnpj)}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <h3 className="text-xl font-bold uppercase text-ink">Recibo de Pagamento</h3>
            <p className="text-sm font-semibold text-ink-muted">Referência: {month}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b-2 border-line bg-surface-muted p-4 sm:grid-cols-4 sm:p-6 print:border-ink print:bg-white">
          <div className="col-span-2">
            <p className={`${ROTULO} mb-1`}>Código / Nome do Funcionário</p>
            <p className="break-words font-semibold text-ink">{employee.id.padStart(4, '0')} - {employee.name}</p>
          </div>
          <div>
            <p className={`${ROTULO} mb-1`}>Setor</p>
            <p className="break-words font-semibold text-ink">{employee.department}</p>
          </div>
          <div>
            <p className={`${ROTULO} mb-1`}>Cargo</p>
            <p className="break-words font-semibold text-ink">{employee.role}</p>
          </div>
        </div>

        <ul className="divide-y divide-dashed divide-line-strong px-4 sm:hidden print:hidden">
          {linhas.map((linha, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-medium text-ink">{linha.descricao}</p>
                {linha.referencia !== '---' && <p className="text-xs text-ink-muted">{linha.referencia}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className={ROTULO}>{linha.tipo === 'vencimento' ? 'Vencimento' : 'Desconto'}</p>
                <p className={`font-semibold ${linha.tipo === 'vencimento' ? 'text-success' : 'text-danger'}`}>{formatCurrency(linha.valor)}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden sm:block print:block overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Vencimentos e descontos do holerite</caption>
            <thead>
              <tr className="border-b-2 border-line bg-surface-muted text-xs uppercase tracking-wider print:border-ink print:bg-white">
                <th scope="col" className="w-1/2 p-4 text-left font-semibold text-ink-muted">Descrição</th>
                <th scope="col" className="p-4 text-center font-semibold text-ink-muted">Referência</th>
                <th scope="col" className="p-4 text-right font-semibold text-success">Vencimentos</th>
                <th scope="col" className="p-4 text-right font-semibold text-danger">Descontos</th>
              </tr>
            </thead>
            <tbody className="align-top font-medium text-ink">
              {linhas.map((linha, idx) => (
                <tr key={idx} className="border-b border-dashed border-line">
                  <td className="p-4">{linha.descricao}</td>
                  <td className="p-4 text-center">{linha.referencia}</td>
                  <td className="p-4 text-right font-semibold">{linha.tipo === 'vencimento' && formatCurrency(linha.valor)}</td>
                  <td className="p-4 text-right font-semibold">{linha.tipo === 'desconto' && formatCurrency(linha.valor)}</td>
                </tr>
              ))}
              <tr><td colSpan={4} className="h-32 print:h-16"></td></tr>
            </tbody>
          </table>
        </div>

        {informativos.length > 0 && (
          <dl className="grid grid-cols-2 gap-4 border-t-2 border-line bg-surface-muted p-4 sm:grid-cols-5 sm:p-6 print:border-ink print:bg-white">
            {informativos.map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className={`${ROTULO} mb-1`}>{rotulo}</dt>
                <dd className="font-semibold text-ink">{valor}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="grid grid-cols-1 border-t-2 border-line sm:grid-cols-2 print:grid-cols-2 print:border-ink">
          <div className="order-2 flex flex-col justify-end border-t-2 border-line p-4 sm:order-1 sm:border-r-2 sm:border-t-0 sm:p-6 print:order-1 print:border-r-2 print:border-t-0 print:border-ink">
            <p className="mb-6 text-xs text-ink-muted">Declaro ter recebido a importância líquida discriminada neste recibo.</p>
            <div className="mt-8 border-t border-ink-subtle pt-2 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Assinatura do Funcionário
            </div>
          </div>
          <div className="order-1 bg-surface-muted sm:order-2 print:order-2 print:bg-white">
            <div className="flex justify-between gap-3 border-b border-line p-4">
              <span className={ROTULO}>Total de Vencimentos</span>
              <span className="font-semibold text-ink">{formatCurrency(employee.totalGross)}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-line p-4">
              <span className={ROTULO}>Total de Descontos</span>
              <span className="font-semibold text-ink">{formatCurrency(employee.totalDeductions)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-ink p-4 text-white sm:p-6 print:bg-white print:text-ink">
              <span className="text-xs font-semibold uppercase tracking-wider">Valor Líquido →</span>
              <span className="text-xl font-bold sm:text-2xl">{formatCurrency(employee.netSalary)}</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body > *:not(.holerite-impressao) { display: none !important; }
          .holerite-impressao { position: static; inset: auto; display: block; padding: 0; background: transparent; }
        }
      `}</style>
    </Modal>
  );
};

export default PayrollSlipModal;
