import React, { useRef, useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import type { Dependent, DependentForm } from '../../services/employeeService';
import { useDependentes, useExcluirDependente, useSalvarDependente } from '../../queries/funcionarios';
import ErrorAlert from '../ErrorAlert';
import Button, { IconButton } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import Field, { Input, Select } from '../ui/Field';
import Skeleton from '../ui/Skeleton';
import { useConfirm } from '../ui/confirmContext';
import { useToast } from '../ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';
import { mascaraCpf } from '../../utils/mascaras';

const PARENTESCOS = ['Filho(a)', 'Cônjuge', 'Enteado(a)', 'Pai ou mãe', 'Outro'] as const;

// Os campos levam o prefixo "dependente" no name: o cadastro do colaborador tem os seus (cpf, por exemplo).
const CAMPO_DO_FORMULARIO: Record<string, keyof DependentForm> = {
  dependenteNome: 'nome', dependenteParentesco: 'parentesco', dependenteDataNascimento: 'dataNascimento', dependenteCpf: 'cpf',
};

const EM_BRANCO: DependentForm = { nome: '', parentesco: 'Filho(a)', dataNascimento: '', cpf: '' };

// 'AAAA-MM-DD' -> 'DD/MM/AAAA', sem passar por Date (o fuso moveria o dia).
const formatDate = (isoDate: string) => isoDate.split('-').reverse().join('/');

interface Props {
  // Sem id o cadastro ainda não existe: os dependentes só se anexam depois de salvo.
  employeeId?: string;
}

// Os dependentes têm rota e gravação próprias (/funcionarios/:id/dependentes), então o formulário
// daqui não vai no envio do modal: cada inclusão, troca ou remoção grava na hora. Por isso os campos
// não usam <form> (o modal já é um) e Enter neles inclui o dependente em vez de enviar o cadastro.
const DependentsTab: React.FC<Props> = ({ employeeId }) => {
  const confirmar = useConfirm();
  const toast = useToast();
  const { data: dependents = [], error: loadError, isPending, refetch } = useDependentes(employeeId);
  const salvar = useSalvarDependente(employeeId ?? '');
  const excluir = useExcluirDependente(employeeId ?? '');
  const [form, setForm] = useState<DependentForm>(EM_BRANCO);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  if (!employeeId) {
    return (
      <EmptyState
        icon={<Users size={28} />}
        title="Salve o cadastro para adicionar dependentes."
        description="Depois de confirmar o cadastro, abra o colaborador de novo em Editar para incluí-los."
        className="py-10"
      />
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const campo = CAMPO_DO_FORMULARIO[e.target.name];
    const { value } = e.target;
    setForm((atual) => ({ ...atual, [campo]: campo === 'cpf' ? mascaraCpf(value) : value }));
  };

  const reset = () => {
    setForm(EM_BRANCO);
    setEditingId(null);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!form.nome.trim()) return setError('Informe o nome do dependente.');
    if (!form.dataNascimento) return setError('Informe a data de nascimento do dependente.');
    try {
      await salvar.mutateAsync({ dados: { ...form, nome: form.nome.trim() }, dependenteId: editingId ?? undefined });
      toast.success(editingId ? 'Dependente atualizado.' : 'Dependente cadastrado.');
      reset();
    } catch (erro) {
      setError(mensagemDeErro(erro, 'Não foi possível salvar o dependente. Tente novamente.'));
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void submit();
  };

  const edit = (dependent: Dependent) => {
    setEditingId(dependent.id);
    setForm({ nome: dependent.nome, parentesco: dependent.parentesco, dataNascimento: dependent.dataNascimento, cpf: dependent.cpf });
    setError(null);
    formRef.current?.querySelector<HTMLElement>('[name="dependenteNome"]')?.focus();
  };

  const remove = async (dependent: Dependent) => {
    const confirmado = await confirmar({
      title: 'Remover dependente?',
      description: `${dependent.nome} deixa de constar como dependente deste colaborador.`,
      confirmLabel: 'Remover',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (!confirmado) return;
    try {
      await excluir.mutateAsync(dependent.id);
      if (editingId === dependent.id) reset();
      toast.success('Dependente removido.');
    } catch (erro) {
      setError(mensagemDeErro(erro, 'Não foi possível remover o dependente. Tente novamente.'));
    }
  };

  return (
    <div className="space-y-6">
      {loadError && <ErrorAlert message={mensagemDeErro(loadError, 'Erro ao buscar os dependentes')} onRetry={() => { void refetch(); }} />}

      {isPending && !loadError ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        !loadError && (dependents.length === 0 ? (
          <p className="rounded-card border border-dashed border-line p-4 text-center text-sm text-ink-muted">Nenhum dependente cadastrado.</p>
        ) : (
          <ul aria-label="Dependentes do colaborador" className="divide-y divide-line rounded-card border border-line">
            {dependents.map((dependent) => (
              <li key={dependent.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-ink">{dependent.nome}</p>
                  <p className="text-sm text-ink-muted">
                    {dependent.parentesco} · nascimento {formatDate(dependent.dataNascimento)}{dependent.cpf ? ` · CPF ${dependent.cpf}` : ''}
                  </p>
                </div>
                <span className="flex shrink-0 gap-1">
                  <IconButton label={`Editar dependente ${dependent.nome}`} size="sm" onClick={() => edit(dependent)}>
                    <Pencil size={18} aria-hidden="true" />
                  </IconButton>
                  <IconButton label={`Remover dependente ${dependent.nome}`} size="sm" onClick={() => { void remove(dependent); }} className="hover:text-danger">
                    <Trash2 size={18} aria-hidden="true" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        ))
      )}

      <div ref={formRef} role="group" aria-label={editingId ? 'Editar dependente' : 'Novo dependente'} className="space-y-5 border-t border-line pt-5" onKeyDown={onEnter}>
        <p className="text-sm font-bold text-ink">{editingId ? 'Editar dependente' : 'Novo dependente'}</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Nome do dependente" name="dependenteNome">
            <Input type="text" autoComplete="off" maxLength={100} value={form.nome} onChange={handleChange} />
          </Field>
          <Field label="Parentesco" name="dependenteParentesco">
            <Select autoComplete="off" value={form.parentesco} onChange={handleChange}>
              {PARENTESCOS.map((parentesco) => <option key={parentesco} value={parentesco}>{parentesco}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Data de nascimento do dependente" name="dependenteDataNascimento">
            <Input type="date" autoComplete="off" max={new Date().toISOString().slice(0, 10)} value={form.dataNascimento} onChange={handleChange} />
          </Field>
          <Field label="CPF do dependente" name="dependenteCpf">
            <Input type="text" inputMode="numeric" autoComplete="off" value={form.cpf} onChange={handleChange} placeholder="123.456.789-09" />
          </Field>
        </div>
        {error && <ErrorAlert message={error} />}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {editingId && <Button variant="secondary" onClick={reset} disabled={salvar.isPending}>Cancelar edição</Button>}
          <Button onClick={() => { void submit(); }} loading={salvar.isPending} icon={editingId ? undefined : <Plus size={18} aria-hidden="true" />}>
            {editingId ? 'Salvar dependente' : 'Adicionar dependente'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DependentsTab;
