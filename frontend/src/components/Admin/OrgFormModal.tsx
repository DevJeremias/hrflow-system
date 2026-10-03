import React, { useState, useRef } from 'react';
import ErrorAlert from '../ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import type { Department, Role } from '../../services/departmentsRolesService';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';

const NIVEIS = ['Júnior', 'Pleno', 'Sênior', 'Gestão', 'Coordenação'];

const DepartmentForm: React.FC<{ item?: Department }> = ({ item }) => (
  <div className="grid grid-cols-1 gap-5">
    <Field label="Nome do Departamento" name="name" required>
      <Input data-autofocus defaultValue={item?.name} autoComplete="off" placeholder="Ex: Engenharia de Software" />
    </Field>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Sigla" name="sigla" required>
        <Input defaultValue={item?.sigla} autoComplete="off" className="uppercase" placeholder="TI" />
      </Field>
      <Field label="Gestor" name="manager">
        <Input defaultValue={item?.manager === 'Não definido' ? '' : item?.manager} autoComplete="off" placeholder="Nome do Gestor" />
      </Field>
    </div>
    <Field label="Descrição" name="description">
      <Textarea rows={3} defaultValue={item?.description} autoComplete="off" className="resize-none" placeholder="Breve descrição das responsabilidades do setor..." />
    </Field>
  </div>
);

const RoleForm: React.FC<{ item?: Role; departments: Department[] }> = ({ item, departments }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Título do Cargo" name="title" required>
        <Input data-autofocus defaultValue={item?.title} autoComplete="off" placeholder="Ex: Analista de Sistemas" />
      </Field>
      <Field label="Setor Responsável" name="department" required>
        <Select defaultValue={item?.department} autoComplete="off">
          <option value="">Selecione...</option>
          {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </Select>
      </Field>
    </div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Nível Hierárquico" name="level">
        <Select defaultValue={item?.level || 'Pleno'} autoComplete="off">
          {NIVEIS.map((nivel) => <option key={nivel}>{nivel}</option>)}
        </Select>
      </Field>
      <Field label="Salário Base (R$)" name="salary" required>
        <Input type="number" min="0" step="0.01" inputMode="decimal" defaultValue={item?.salary ?? undefined} autoComplete="off" placeholder="0.00" />
      </Field>
    </div>
  </div>
);

interface Props {
  type: 'department' | 'role';
  item?: Department | Role | null;
  departments: Department[];
  onClose: () => void;
  onSave: (data: Record<string, FormDataEntryValue | undefined>) => Promise<void>;
}

const OrgFormModal: React.FC<Props> = ({ type, item, departments, onClose, onSave }) => {
  const isDept = type === 'department';

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // O estado só muda no próximo render: o ref fecha a janela entre dois cliques seguidos.
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSave({ ...data, id: item?.id });
    } catch (error) {
      setSubmitError(mensagemDeErro(error, 'Não foi possível salvar. Tente novamente.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`${item ? 'Editar' : 'Novo'} ${isDept ? 'Departamento' : 'Cargo'}`}
      description="Preencha os dados estruturais abaixo."
      onClose={() => { if (!submittingRef.current) onClose(); }}
      form={{ onSubmit: handleSubmit }}
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" loading={submitting}>{submitting ? 'Salvando...' : 'Finalizar Registro'}</Button>
        </div>
      )}
    >
      {isDept ? <DepartmentForm item={item as Department | undefined} /> : <RoleForm item={item as Role | undefined} departments={departments} />}
      {submitError && <div className="mt-6"><ErrorAlert message={submitError} /></div>}
    </Modal>
  );
};

export default OrgFormModal;
