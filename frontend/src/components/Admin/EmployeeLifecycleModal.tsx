import React, { useRef, useState } from 'react';
import { Check, Copy, EyeOff, KeyRound, Trash2, UserCheck, UserMinus } from 'lucide-react';
import { Employee, employeeService } from '../../services/employeeService';
import ErrorAlert from '../ErrorAlert';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input } from '../ui/Field';
import { useToast } from '../ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';

export type LifecycleKind = 'offboard' | 'reactivate' | 'reset' | 'delete' | 'anonymize';

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
  sucesso: (name: string) => string;
  effects: (name: string) => string[];
  confirm: string;
  busy: string;
  icon: React.ReactNode;
  variant: 'primary' | 'danger';
}> = {
  offboard: {
    sucesso: (name) => `${name} foi inativado.`,
    title: (name) => `Inativar ou desligar ${name}`,
    effects: (name) => [
      `${name} perde o acesso ao sistema agora e as sessões abertas são encerradas.`,
      'O cadastro, as marcações de ponto e as justificativas continuam guardados.',
      'A pessoa segue na folha do mês do desligamento e sai a partir do mês seguinte.',
      'Você pode reativar o colaborador depois.',
    ],
    confirm: 'Inativar colaborador',
    busy: 'Inativando...',
    icon: <UserMinus size={22} aria-hidden="true" />,
    variant: 'primary',
  },
  reactivate: {
    sucesso: (name) => `${name} foi reativado.`,
    title: (name) => `Reativar ${name}`,
    effects: (name) => [
      `${name} volta a entrar no sistema com a senha que já tinha. Se ela foi esquecida, redefina-a depois.`,
      'A data e o motivo do desligamento são apagados.',
      'O histórico de ponto continua o mesmo.',
    ],
    confirm: 'Reativar colaborador',
    busy: 'Reativando...',
    icon: <UserCheck size={22} aria-hidden="true" />,
    variant: 'primary',
  },
  reset: {
    sucesso: () => '',
    title: (name) => `Redefinir a senha de ${name}`,
    effects: (name) => [
      'Geramos uma senha provisória e a mostramos uma única vez, nesta tela. Anote-a e entregue a quem a pediu.',
      'A senha atual deixa de valer e as sessões abertas são encerradas.',
      `No primeiro acesso, ${name} precisa trocar a senha provisória por uma própria.`,
    ],
    confirm: 'Gerar senha provisória',
    busy: 'Gerando...',
    icon: <KeyRound size={22} aria-hidden="true" />,
    variant: 'primary',
  },
  delete: {
    sucesso: () => 'Cadastro excluído.',
    title: (name) => `Excluir o cadastro de ${name}`,
    effects: (name) => [
      `O cadastro e o acesso de ${name} são apagados para sempre. Não há como desfazer.`,
      'Só é possível porque não há ponto nem justificativas registrados. Quem já trabalhou na empresa é inativado, nunca excluído.',
    ],
    confirm: 'Excluir cadastro',
    busy: 'Excluindo...',
    icon: <Trash2 size={22} aria-hidden="true" />,
    variant: 'danger',
  },
  anonymize: {
    sucesso: () => 'Cadastro anonimizado.',
    title: (name) => `Anonimizar o cadastro de ${name}`,
    effects: (name) => [
      `CPF, nome, e-mail, telefone, endereço, dados bancários e foto de ${name} são apagados para sempre. Não há como desfazer.`,
      'As marcações de ponto, as decisões e os valores da folha continuam, ligados ao código do cadastro e sem identificar a pessoa.',
      'A localização das marcações e o texto das justificativas também são apagados, assim como o conteúdo pessoal da trilha de auditoria.',
      'Baixe antes a cópia dos dados (Exportar dados) se a empresa precisar entregá-la ao titular.',
    ],
    confirm: 'Anonimizar cadastro',
    busy: 'Anonimizando...',
    icon: <EyeOff size={22} aria-hidden="true" />,
    variant: 'danger',
  },
};

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
  const toast = useToast();

  const { kind, employee } = action;
  const content = CONTENT[kind];
  const name = employee.nomeCompleto;

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
    } else if (kind === 'anonymize') {
      await employeeService.anonymize(employee.id);
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
        toast.success(content.sucesso(name));
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
    <Modal
      title={content.title(name)}
      size="sm"
      onClose={close}
      form={temporaryPassword ? undefined : { onSubmit: handleSubmit }}
      footer={temporaryPassword ? (
        <Button fullWidth onClick={onClose} data-autofocus>Concluir</Button>
      ) : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={submitting}>Cancelar</Button>
          <Button type="submit" variant={content.variant} loading={submitting} data-autofocus={kind === 'offboard' ? undefined : true}>
            {submitting ? content.busy : content.confirm}
          </Button>
        </div>
      )}
    >
      {temporaryPassword ? (
        <div className="space-y-5">
          <p className="text-ink-muted">
            Senha provisória de <strong className="text-ink">{name}</strong>. Ela não será exibida de novo: anote-a agora e entregue a quem a pediu.
          </p>
          <div className="flex items-center gap-3 rounded-card border border-warning-line bg-warning-soft p-4">
            <output data-testid="temporary-password" className="min-w-0 flex-1 select-all break-all font-mono text-2xl font-bold tracking-wider text-ink">{temporaryPassword}</output>
            <Button variant="secondary" size="sm" onClick={copyPassword} icon={copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}>
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
          <p className="text-sm text-ink-muted">No primeiro acesso, {name} será levado a trocar esta senha por uma própria.</p>
          {error && <ErrorAlert message={error} />}
        </div>
      ) : (
        <div className="space-y-5">
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink-muted">
            {content.effects(name).map((effect) => <li key={effect}>{effect}</li>)}
          </ul>

          {kind === 'offboard' && (
            <div className="grid grid-cols-1 gap-4">
              <Field label="Data do desligamento" name="dataDesligamento" required>
                <Input data-autofocus type="date" autoComplete="off" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Motivo" name="motivoDesligamento" required>
                <Input type="text" autoComplete="off" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: pedido de demissão, fim do contrato" />
              </Field>
            </div>
          )}

          {error && <ErrorAlert message={error} />}
        </div>
      )}
    </Modal>
  );
};

export default EmployeeLifecycleModal;
