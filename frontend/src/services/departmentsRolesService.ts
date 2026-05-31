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
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const saveDepartment = async (data: any): Promise<void> => {
  const res = await fetch(`${API_URL}/departamentos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Erro ao salvar departamento');
};

export const getRoles = async (): Promise<Role[]> => {
  try {
    const res = await fetch(`${API_URL}/cargos`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Erro ao buscar cargos');
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const saveRole = async (data: any): Promise<void> => {
  // Como o formulário envia apenas o nome do departamento, fazemos uma busca
  // rápida para encontrar qual é o ID correspondente antes de enviar para o Node.js
  const deptsRes = await fetch(`${API_URL}/departamentos`, { headers: getAuthHeaders() });
  const depts = await deptsRes.json();
  const deptFound = depts.find((d: any) => d.name === data.department);

  const payload = {
    id: data.id,
    title: data.title,
    level: data.level,
    salary: parseFloat(data.salary) || 0,
    departamento_id: deptFound ? deptFound.id : null
  };

  const res = await fetch(`${API_URL}/cargos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) throw new Error('Erro ao salvar cargo');
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