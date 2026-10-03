import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, Trash2, UserCheck, UserMinus, X } from 'lucide-react';
import { Employee, employeeService } from '../../services/employeeService';
import ErrorAlert from '../ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

export type LifecycleKind = 'offboard' | 'reactivate' | 'reset' | 'delete';

export interface LifecycleAction {
  kind: LifecycleKind;
  employee: Employee;
}

interface Props {
  action: LifecycleAction;
  onClose: () => void;
  // Chamado depois que a API aceitou a ação, para a lista se recarregar.
  onDone: () => Promise<void> | void;
}

const today = () => new Date().toISOString().slice(0, 10);

const CONTENT: Record<LifecycleKind, {
  title: (name: string) => string;
  effects: (name: string) => string[];
  confirm: string;
  busy: string;
  icon: React.ReactNode;
  tone: string;
}> = {
  offboard: {
    title: (name) => `Inativar ou desligar ${name}`,
    effects: (name) => [
      `${name} perde o acesso ao sistema agora e as sessões abertas são encerradas.`,
      'O cadastro, as marcações de ponto e as justificativas continuam guardados.',
      'A pessoa segue na folha do mês do desligamento e sai a partir do mês seguinte.',
      'Você pode reativar o colaborador depois.',
    ],
    confirm: 'Inativar colaborador',
    busy: 'Inativando...',
    icon: <UserMinus size={22} />,
    tone: 'bg-slate-900 hover:bg-slate-700',
  },
  reactivate: {
    title: (name) => `Reativar ${name}`,
    effects: (name) => [
      `${name} volta a entrar no sistema com a senha que já tinha. Se ela foi esquecida, redefina-a depois.`,
      'A data e o motivo do desligamento são apagados.',
      'O histórico de ponto continua o mesmo.',
    ],
    confirm: 'Reativar colaborador',
    busy: 'Reativando...',
    icon: <UserCheck size={22} />,
    tone: 'bg-emerald-600 hover:bg-emerald-700',
  },
  reset: {
    title: (name) => `Redefinir a senha de ${name}`,
    effects: (name) => [
      'Geramos uma senha provisória e a mostramos uma única vez, nesta tela. Anote-a e entregue a quem a pediu.',
      'A senha atual deixa de valer e as sessões abertas são encerradas.',
      `No primeiro acesso, ${name} precisa trocar a senha provisória por uma própria.`,
    ],
    confirm: 'Gerar senha provisória',
    busy: 'Gerando...',
    icon: <KeyRound size={22} />,
    tone: 'bg-slate-900 hover:bg-slate-700',
  },
  delete: {
    title: (name) => `Excluir o cadastro de ${name}`,
    effects: (name) => [
      `O cadastro e o acesso de ${name} são apagados para sempre. Não há como desfazer.`,
      'Só é possível porque não há ponto nem justificativas registrados. Quem já trabalhou na empresa é inativado, nunca excluído.',
    ],
    confirm: 'Excluir cadastro',
    busy: 'Excluindo...',
    icon: <Trash2 size={22} />,
    tone: 'bg-red-600 hover:bg-red-700',
  },
};

const fieldClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none';

// Confirmação das ações que mudam o acesso de um colaborador: cada uma diz o que vai acontecer
// antes de acontecer, e a senha provisória aparece aqui, uma vez, e em nenhum outro lugar. Quem
// renderiza monta uma instância por ação, então o estado nasce limpo a cada uma.
const EmployeeLifecycleModal: React.FC<Props> = ({ action, onClose, onDone }) => {
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // O estado só muda no próximo render: o ref fecha a janela entre dois cliques seguidos.
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('input, button[data-primary]')?.focus();
  }, []);

  const { kind, employee } = action;
  const content = CONTENT[kind];
  const name = employee.nomeCompleto;
  const titleId = 'employee-lifecycle-title';

  const close = () => {
    if (!submittingRef.current) onClose();
  };

  const run = async () => {
    if (kind === 'offboard') {
      await employeeService.changeStatus(employee.id, { status: 'Inativo', date, reason: reason.trim() });
    } else if (kind === 'reactivate') {
      await employeeService.changeStatus(employee.id, { status: 'Ativo' });
    } else if (kind === 'delete') {
      await employeeService.delete(employee.id);
    } else {
      setTemporaryPassword(await employeeService.resetPassword(employee.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await run();
      // A senha provisória fica na tela até o RH concluir; nada na lista mudou.
      if (kind !== 'reset') {
        await onDone();
        onClose();
      }
    } catch (err) {
      setError(mensagemDeErro(err, 'Não foi possível concluir a ação. Tente novamente.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword ?? '');
      setCopied(true);
    } catch {
      setError('Não foi possível copiar. Selecione a senha e copie manualmente.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <div data-testid="employee-lifecycle-backdrop" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={close} />

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8">
          <h2 id={titleId} className="flex items-center gap-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            <span className="shrink-0 text-slate-500">{content.icon}</span>
            <span>{content.title(name)}</span>
          </h2>
          <button type="button" onClick={close} aria-label="Fechar" className="shrink-0 rounded-xl p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500">
            <X size={22} />
          </button>
        </div>

        {temporaryPassword ? (
          <div className="space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
            <p className="font-medium text-slate-600">
              Senha provisória de <strong>{name}</strong>. Ela não será exibida de novo: anote-a agora e entregue a quem a pediu.
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <output data-testid="temporary-password" className="min-w-0 flex-1 select-all break-all font-mono text-2xl font-black tracking-wider text-slate-900">{temporaryPassword}</output>
              <button type="button" onClick={copyPassword} className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-amber-100">
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiada' : 'Copiar'}
              </button>
            </div>
            <p className="text-sm font-medium text-slate-500">No primeiro acesso, {name} será levado a trocar esta senha por uma própria.</p>
            {error && <ErrorAlert message={error} />}
            <button type="button" onClick={onClose} data-primary className="w-full rounded-2xl bg-slate-900 py-4 font-black text-white shadow-xl shadow-slate-200 transition-all hover:bg-primary active:scale-95">
              Concluir
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
              <ul className="list-disc space-y-2 pl-5 text-sm font-medium text-slate-600">
                {content.effects(name).map((effect) => <li key={effect}>{effect}</li>)}
              </ul>

              {kind === 'offboard' && (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="data-desligamento" className="mb-2 block text-sm font-bold text-slate-700">Data do desligamento *</label>
                    <input id="data-desligamento" name="dataDesligamento" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label htmlFor="motivo-desligamento" className="mb-2 block text-sm font-bold text-slate-700">Motivo *</label>
                    <input id="motivo-desligamento" name="motivoDesligamento" type="text" required maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} placeholder="Ex.: pedido de demissão, fim do contrato" />
                  </div>
                </div>
              )}

              {error && <ErrorAlert message={error} />}
            </div>

            <div className="flex gap-4 border-t border-slate-100 px-6 py-5 sm:px-8">
              <button type="button" onClick={close} disabled={submitting} className="flex-1 rounded-2xl bg-slate-100 py-4 font-bold text-slate-600 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" data-primary disabled={submitting} className={`flex-[2] rounded-2xl py-4 font-black text-white shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${content.tone}`}>
                {submitting ? content.busy : content.confirm}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EmployeeLifecycleModal;
