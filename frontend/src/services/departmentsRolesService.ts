import httpClient from './httpClient';
import type { CargoApi, CorpoDeCargoApi, CorpoDeDepartamentoApi, DepartamentoApi } from '../types/api';

// src/services/departmentsRolesService.ts

export interface Department {
  id: string;
  name: string;
  sigla: string;
  description: string;
  collaborators: number;
  active: number;
  manager: string;
  rolesCount: number;
}

export interface Role {
  id: string;
  title: string;
  department: string;
  departmentId: string;
  level: string | null;
  salary: number | null;
  occupants: number;
}

// O que o formulário de departamento entrega (ver OrgFormModal).
export interface DepartmentForm {
  id?: string;
  name: string;
  sigla: string;
  description: string;
  manager: string;
}

// O que o formulário de cargo entrega. `department` é o nome ou a sigla do departamento.
export interface RoleForm {
  id?: string;
  title: string;
  department: string;
  level: string;
  salary: string;
}

const API_URL = '/estrutura';

export const getDepartments = async (): Promise<Department[]> => {
  const data = await httpClient<DepartamentoApi[]>(`${API_URL}/departamentos`, { auth: true, errorMessage: 'Erro ao buscar departamentos' });
  return data.map((d) => ({
    id: d.id.toString(),
    name: d.nome,
    sigla: d.sigla,
    description: d.descricao || '',
    manager: d.gestor || 'Não definido',
    collaborators: Number(d.total_colaboradores) || 0,
    active: Number(d.colaboradores_ativos) || 0,
    rolesCount: Number(d.total_cargos) || 0
  }));
};

export const saveDepartment = async (data: DepartmentForm): Promise<void> => {
  const isEditing = !!data.id;
  const url = isEditing ? `${API_URL}/departamentos/${data.id}` : `${API_URL}/departamentos`;
  
  const payload: CorpoDeDepartamentoApi = {
    nome: data.name,
    sigla: data.sigla, 
    descricao: data.description, 
    gestor: data.manager 
  };
  
  await httpClient(url, {
    method: isEditing ? 'PUT' : 'POST',
    auth: true,
    body: JSON.stringify(payload),
    errorMessage: (err) => err?.erro || 'Erro ao salvar departamento'
  });
};

export const deleteDepartment = async (id: string): Promise<void> => {
  await httpClient(`${API_URL}/departamentos/${id}`, { 
    method: 'DELETE', 
    auth: true,
    errorMessage: (err) => err?.erro || 'Erro ao deletar departamento'
  });
};

export const getRoles = async (): Promise<Role[]> => {
  const data = await httpClient<CargoApi[]>(`${API_URL}/cargos`, { auth: true, errorMessage: 'Erro ao buscar cargos' });
  return data.map((c) => ({
    id: c.id.toString(),
    title: c.nome,
    department: c.departamento_nome ?? '',
    departmentId: c.departamento_id?.toString() ?? '',
    level: c.nivel || null,
    // A API grava 0.00 quando o cargo nasce sem salário: zero e ausente significam o mesmo.
    salary: parseFloat(c.salario_base ?? '') || null,
    occupants: Number(c.ocupantes) || 0
  }));
};

export const saveRole = async (data: RoleForm): Promise<void> => {
  const depts = await httpClient<DepartamentoApi[]>(`${API_URL}/departamentos`, { auth: true });
  const deptFound = depts.find((d) => d.nome === data.department || d.sigla === data.department);

  const payload: CorpoDeCargoApi = {
    nome: data.title,
    nivel: data.level,
    salario_base: parseFloat(data.salary) || 0,
    departamento_id: deptFound ? deptFound.id : null
  };

  const isEditing = !!data.id;
  const url = isEditing ? `${API_URL}/cargos/${data.id}` : `${API_URL}/cargos`;

  await httpClient(url, {
    method: isEditing ? 'PUT' : 'POST',
    auth: true,
    body: JSON.stringify(payload),
    errorMessage: (err) => err?.erro || 'Erro ao salvar cargo'
  });
};

export const deleteRole = async (id: string): Promise<void> => {
  await httpClient(`${API_URL}/cargos/${id}`, { 
    method: 'DELETE', 
    auth: true,
    errorMessage: (err) => err?.erro || 'Erro ao deletar cargo'
  });
};
