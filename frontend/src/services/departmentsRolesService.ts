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

const API_URL = 'http://localhost:3000/api/estrutura';

// Utilitário para montar o cabeçalho com o Token do usuário logado
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const getDepartments = async (): Promise<Department[]> => {
  try {
    const res = await fetch(`${API_URL}/departamentos`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Erro ao buscar departamentos');
    const data = await res.json();
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
  
  const res = await fetch(url, {
    method: isEditing ? 'PUT' : 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.erro || 'Erro ao salvar departamento');
  }
};

export const deleteDepartment = async (id: string): Promise<void> => {
  const res = await fetch(`${API_URL}/departamentos/${id}`, { 
    method: 'DELETE', 
    headers: getAuthHeaders() 
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.erro || 'Erro ao deletar departamento');
  }
};

export const getRoles = async (): Promise<Role[]> => {
  try {
    const res = await fetch(`${API_URL}/cargos`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Erro ao buscar cargos');
    const data = await res.json();
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
  const deptsRes = await fetch(`${API_URL}/departamentos`, { headers: getAuthHeaders() });
  const depts = await deptsRes.json();
  const deptFound = depts.find((d: any) => d.nome === data.department || d.sigla === data.department);

  const payload = {
    nome: data.title,
    nivel: data.level,
    salario_base: parseFloat(data.salary) || 0,
    departamento_id: deptFound ? deptFound.id : null
  };

  const isEditing = !!data.id;
  const url = isEditing ? `${API_URL}/cargos/${data.id}` : `${API_URL}/cargos`;

  const res = await fetch(url, {
    method: isEditing ? 'PUT' : 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.erro || 'Erro ao salvar cargo');
  }
};

export const deleteRole = async (id: string): Promise<void> => {
  const res = await fetch(`${API_URL}/cargos/${id}`, { 
    method: 'DELETE', 
    headers: getAuthHeaders() 
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.erro || 'Erro ao deletar cargo');
  }
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