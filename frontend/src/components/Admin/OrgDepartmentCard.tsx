import React from 'react';
import { Building2, Pencil, Trash2 } from 'lucide-react';
import type { Department } from '../../services/departmentsRolesService';
import Card from '../ui/Card';
import { IconButton } from '../ui/Button';

interface Props {
  department: Department;
  onEdit: () => void;
  onDelete: () => void;
}

const iniciais = (nome: string) => {
  if (!nome) return '--';
  return nome.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
};

const OrgDepartmentCard: React.FC<Props> = ({ department, onEdit, onDelete }) => (
  <Card as="article" padding="md" className="flex h-full flex-col">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
          <Building2 size={24} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight text-ink">{department.name}</h2>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{department.sigla || 'S/S'}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <IconButton label={`Editar departamento ${department.name}`} size="sm" onClick={onEdit}><Pencil size={18} aria-hidden="true" /></IconButton>
        <IconButton label={`Excluir departamento ${department.name}`} size="sm" onClick={onDelete} className="hover:text-danger"><Trash2 size={18} aria-hidden="true" /></IconButton>
      </div>
    </div>

    <p className="mb-5 line-clamp-2 min-h-10 text-sm text-ink-muted">
      {department.description || 'Nenhuma descrição adicionada.'}
    </p>

    <div className="mb-5 grid grid-cols-2 gap-4 rounded-control bg-surface-sunken p-4">
      <div className="border-r border-line-strong text-center">
        <span className="block text-xl font-bold text-ink">{department.collaborators || 0}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Total</span>
      </div>
      <div className="text-center">
        <span className="block text-xl font-bold text-success">{department.active || 0}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Ativos</span>
      </div>
    </div>

    <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-fill text-xs font-bold text-brand-foreground">
        {iniciais(department.manager)}
      </span>
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase text-ink-muted">Gestor</span>
        <span className="text-sm font-semibold text-ink">{department.manager || 'Não definido'}</span>
      </div>
    </div>
  </Card>
);

export default OrgDepartmentCard;
