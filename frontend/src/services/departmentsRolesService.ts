import httpClient from './httpClient';

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
  deptSigla: string;
  level: string;
  salary: number;
  occupants: number;
  earnings?: any[];
  deductions?: any[];
}

const API_URL = '/estrutura';

export const getDepartments = async (): Promise<Department[]> => {
  try {
    const data = await httpClient<any[]>(`${API_URL}/departamentos`, { auth: true, errorMessage: 'Erro ao buscar departamentos' });
    return data.map((d: any) => ({
      id: d.id.toString(),
      name: d.nome,
      sigla: d.sigla,
      description: d.descricao || '',
      manager: d.gestor || 'Não definido',
      collaborators: 0,
      active: 0,
      rolesCount: 0
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const saveDepartment = async (data: any): Promise<void> => {
  const isEditing = !!data.id;
  const url = isEditing ? `${API_URL}/departamentos/${data.id}` : `${API_URL}/departamentos`;
  
  const payload = { 
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
  try {
    const data = await httpClient<any[]>(`${API_URL}/cargos`, { auth: true, errorMessage: 'Erro ao buscar cargos' });
    return data.map((c: any) => ({
      id: c.id.toString(),
      title: c.nome,
      department: c.departamento_nome,
      deptSigla: c.departamento_nome,
      level: c.nivel || 'Júnior',
      salary: parseFloat(c.salario_base) || 0,
      occupants: 0
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const saveRole = async (data: any): Promise<void> => {
  const depts = await httpClient<any[]>(`${API_URL}/departamentos`, { auth: true });
  const deptFound = depts.find((d: any) => d.nome === data.department || d.sigla === data.department);

  const payload = {
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

// Mantemos este dicionário fixo para já. Na Fase 3 (Folha), 
// se quisermos, podemos ligar isto a uma tabela real.
export const getStandardItems = async (): Promise<any> => {
  return {
    earnings: [
      { id: '1', name: 'Auxílio Home Office' },
      { id: '2', name: 'Vale Alimentação' },
      { id: '3', name: 'Bônus de Desempenho' }
    ],
    deductions: [
      { id: '1', name: 'Plano de Saúde' },
      { id: '2', name: 'Vale Transporte' },
      { id: '3', name: 'Coparticipação' }
    ]
  };
};