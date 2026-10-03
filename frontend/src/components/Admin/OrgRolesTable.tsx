import React from 'react';
import { Pencil, Trash2, Briefcase, Users } from 'lucide-react';
import type { Role } from '../../services/departmentsRolesService';
import DataTable, { type Column } from '../ui/DataTable';
import Badge, { type BadgeTone } from '../ui/Badge';
import { IconButton } from '../ui/Button';

interface Props {
  roles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

const TOM_DO_NIVEL: Record<string, BadgeTone> = {
  'Júnior': 'info',
  'Pleno': 'brand',
  'Sênior': 'success',
  'Gestão': 'danger',
  'Coordenação': 'warning',
};

const OrgRolesTable: React.FC<Props> = ({ roles, onEdit, onDelete }) => {
  const columns: Column<Role>[] = [
    {
      key: 'cargo',
      header: 'Cargo',
      cell: (role) => (
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="rounded-control bg-brand-soft p-2 text-brand"><Briefcase size={16} /></span>
          <span className="font-semibold text-ink">{role.title}</span>
        </span>
      ),
    },
    { key: 'departamento', header: 'Departamento', cell: (role) => <span className="text-ink-muted">{role.department}</span> },
    {
      key: 'nivel',
      header: 'Nível',
      cell: (role) => <Badge tone={TOM_DO_NIVEL[role.level ?? ''] ?? 'neutral'}>{role.level ?? 'Não informado'}</Badge>,
    },
    {
      key: 'salario',
      header: 'Salário base',
      cell: (role) => (role.salary === null
        ? <span className="text-ink-muted">Sem salário base</span>
        : <span className="font-semibold text-ink">{role.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>),
    },
    {
      key: 'ocupantes',
      header: 'Ocupantes',
      cell: (role) => (
        <span className="flex items-center gap-2 font-semibold text-ink-muted">
          <Users size={16} aria-hidden="true" />{role.occupants}
        </span>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      semRotuloNoCartao: true,
      cell: (role) => (
        <span className="flex justify-end gap-1">
          <IconButton label={`Editar cargo ${role.title}`} size="sm" onClick={() => onEdit(role)}><Pencil size={16} aria-hidden="true" /></IconButton>
          <IconButton label={`Excluir cargo ${role.title}`} size="sm" onClick={() => onDelete(role)} className="hover:text-danger"><Trash2 size={16} aria-hidden="true" /></IconButton>
        </span>
      ),
    },
  ];

  return (
    <div className="md:rounded-card md:border md:border-line md:bg-surface md:shadow-card">
      <DataTable caption="Cargos da empresa" columns={columns} rows={roles} rowKey={(role) => role.id} />
    </div>
  );
};

export default OrgRolesTable;
