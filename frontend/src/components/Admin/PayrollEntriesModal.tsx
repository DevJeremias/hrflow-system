import React, { useState } from 'react';
import type { EmployeePayroll, PayrollEntries } from '../../services/payrollService';
import { useSalvarLancamentos } from '../../queries/folha';
import { mensagemDeErro } from '../../utils/erros';
import ErrorAlert from '../ErrorAlert';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input } from '../ui/Field';
import { useToast } from '../ui/toastContext';

interface Props {
  competencia: string;
  // O mês por extenso, para o título e as mensagens.
  mes: string;
  employee: EmployeePayroll;
  // Folha fechada: os lançamentos só se leem.
  locked: boolean;
  onClose: () => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CAMPOS: { chave: keyof PayrollEntries; rotulo: string; dica?: (salario: number) => string }[] = [
  { chave: 'adiantamento', rotulo: 'Adiantamento salarial (R$)' },
  { chave: 'valeTransporte', rotulo: 'Vale-transporte: custo do mês (R$)', dica: (salario) => `O desconto é o menor entre este custo e 6% do salário (${currency.format(salario * 0.06)}).` },
  { chave: 'valeRefeicao', rotulo: 'Vale-refeição (R$)' },
  { chave: 'planoSaude', rotulo: 'Plano de saúde (R$)' },
];

// Os valores em texto (o que o campo guarda) e o texto vazio como zero: a API trata o que falta como zero.
const emTexto = (valor: number): string => (valor === 0 ? '' : String(valor));
const emNumero = (texto: string): number => (texto.trim() === '' ? 0 : Number(texto.replace(',', '.')));

// Os lançamentos do colaborador na folha aberta; os dependentes que reduzem o IRRF só se mostram, o cadastro
// deles é a aba Dependentes do colaborador.
const PayrollEntriesModal: React.FC<Props> = ({ competencia, mes, employee, locked, onClose }) => {
  const toast = useToast();
  const salvar = useSalvarLancamentos(competencia, employee.id);
  const [valores, setValores] = useState<Record<keyof PayrollEntries, string>>(() => ({
    adiantamento: emTexto(employee.lancamentos.adiantamento),
    valeTransporte: emTexto(employee.lancamentos.valeTransporte),
    valeRefeicao: emTexto(employee.lancamentos.valeRefeicao),
    planoSaude: emTexto(employee.lancamentos.planoSaude),
  }));
  const [erro, setErro] = useState<string | null>(null);

  // O que veio do ponto no processamento: horas extras e faltas. Só se lê aqui.
  const doPonto = [
    ...employee.earningsList.map((linha) => ({ ...linha, sinal: '+' })),
    ...employee.deductionsList.filter((linha) => linha.description === 'Faltas').map((linha) => ({ ...linha, sinal: '-' })),
  ];

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const lancamentos = Object.fromEntries(CAMPOS.map(({ chave }) => [chave, emNumero(valores[chave])])) as unknown as PayrollEntries;
    if (Object.values(lancamentos).some((valor) => !Number.isFinite(valor) || valor < 0)) {
      setErro('Informe valores a partir de zero, em reais.');
      return;
    }
    try {
      await salvar.mutateAsync(lancamentos);
      toast.success(`Lançamentos de ${employee.name} salvos: o holerite de ${mes} foi recalculado.`);
      onClose();
    } catch (falha) {
      setErro(mensagemDeErro(falha, 'Não foi possível salvar os lançamentos.'));
    }
  };

  return (
    <Modal
      title={`Lançamentos de ${employee.name}`}
      description={`Folha de ${mes}${locked ? ', fechada: os lançamentos não podem mais mudar.' : '.'}`}
      onClose={onClose}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
    >
      <div className="space-y-8">
        <section aria-labelledby="lancamentos-do-ponto" className="space-y-2">
          <h3 id="lancamentos-do-ponto" className="text-sm font-bold uppercase tracking-wider text-ink-muted">Vindo do ponto</h3>
          {doPonto.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma hora extra nem falta apurada neste mês. O ponto é lido toda vez que a folha é processada.</p>
          ) : (
            <ul className="divide-y divide-line rounded-card border border-line text-sm">
              {doPonto.map((linha) => (
                <li key={linha.description} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-ink">{linha.description}{linha.reference ? <span className="text-ink-muted">{` (${linha.reference})`}</span> : null}</span>
                  <span className={`font-semibold ${linha.sinal === '+' ? 'text-success' : 'text-danger'}`}>{linha.sinal} {currency.format(linha.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={enviar} aria-labelledby="lancamentos-do-mes" className="space-y-4">
          <h3 id="lancamentos-do-mes" className="text-sm font-bold uppercase tracking-wider text-ink-muted">Lançamentos do mês</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CAMPOS.map(({ chave, rotulo, dica }) => (
              <Field key={chave} label={rotulo} name={chave} hint={dica?.(employee.baseSalary)}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  autoComplete="off"
                  placeholder="0,00"
                  disabled={locked}
                  value={valores[chave]}
                  onChange={(e) => setValores({ ...valores, [chave]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <p className="text-xs text-ink-muted">Descontos do colaborador: não reduzem a base do INSS nem a do IRRF. Ao salvar, o holerite dele é recalculado.</p>
          {erro && <ErrorAlert message={erro} />}
          {!locked && (
            <div className="flex justify-end">
              <Button type="submit" loading={salvar.isPending}>{salvar.isPending ? 'Salvando...' : 'Salvar lançamentos'}</Button>
            </div>
          )}
        </form>

        <section aria-labelledby="dependentes-do-irrf" className="space-y-1">
          <h3 id="dependentes-do-irrf" className="text-sm font-bold uppercase tracking-wider text-ink-muted">Dependentes para o IRRF</h3>
          <p className="text-sm text-ink">
            {employee.dependents === 0 ? 'Nenhum dependente considerado neste holerite.' : `${employee.dependents} ${employee.dependents === 1 ? 'dependente considerado' : 'dependentes considerados'} neste holerite.`}
          </p>
          <p className="text-xs text-ink-muted">Cada dependente reduz a base do IRRF em R$ 189,59. Cadastre-os em Colaboradores, na aba Dependentes; a mudança vale quando a folha é processada de novo.</p>
        </section>
      </div>
    </Modal>
  );
};

export default PayrollEntriesModal;
