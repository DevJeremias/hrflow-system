// src/services/departmentsRolesService.ts

// =========================================================
// 1. INTERFACES (Tipagens do TypeScript)
// =========================================================
export interface DynamicItem {
  description: string;
  valueType: 'fixed' | 'percentage';
  value: string;
}

export interface Role {
  id: string;
  title: string;
  department: string;
  deptSigla: string;
  level: string;
  salary: number;
  occupants: number;
  earnings?: DynamicItem[];
  deductions?: DynamicItem[];
}

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

export interface DictionaryItem {
  id: string;
  name: string;
}

export interface StandardDictionary {
  earnings: DictionaryItem[];
  deductions: DictionaryItem[];
}

// =========================================================
// 2. MOCK DATA (Simulação do Banco de Dados em Memória)
// =========================================================

let mockDepartments: Department[] = [
  { 
    id: '1', 
    name: 'Tecnologia', 
    sigla: 'TI', 
    description: 'Responsável por toda a infraestrutura digital e desenvolvimento de produtos.',
    collaborators: 24, 
    active: 22, 
    manager: 'Carlos Lima', 
    rolesCount: 8 
  },
  { 
    id: '2', 
    name: 'Recursos Humanos', 
    sigla: 'RH', 
    description: 'Focado em cultura, bem-estar e aquisição de talentos estratégicos.',
    collaborators: 6, 
    active: 6, 
    manager: 'Ana Souza', 
    rolesCount: 3 
  }
];

let mockRoles: Role[] = [
  { 
    id: '1', 
    title: 'Engenheiro de Software', 
    department: 'Tecnologia', 
    deptSigla: 'TI', 
    level: 'Sênior', 
    salary: 12500, 
    occupants: 4,
    earnings: [{ description: 'Auxílio Home Office', valueType: 'fixed', value: '500' }],
    deductions: [{ description: 'Plano de Saúde', valueType: 'fixed', value: '150' }]
  },
  { 
    id: '2', 
    title: 'Analista de Recrutamento', 
    department: 'Recursos Humanos', 
    deptSigla: 'RH', 
    level: 'Pleno', 
    salary: 5800, 
    occupants: 2,
    earnings: [{ description: 'Vale Refeição', valueType: 'fixed', value: '800' }],
    deductions: [{ description: 'INSS', valueType: 'percentage', value: '11' }]
  }
];

let standardItems: StandardDictionary = {
  earnings: [
    { id: '1', name: 'Vale Refeição' },
    { id: '2', name: 'Vale Alimentação' },
    { id: '3', name: 'Auxílio Home Office' },
    { id: '4', name: 'Bônus de Desempenho' }
  ],
  deductions: [
    { id: '1', name: 'INSS' },
    { id: '2', name: 'IRRF' },
    { id: '3', name: 'Plano de Saúde' },
    { id: '4', name: 'Vale Transporte' }
  ]
};

// =========================================================
// 3. FUNÇÕES DE SERVIÇO (As que serão conectadas à API depois)
// =========================================================

// Busca todos os Departamentos
export const getDepartments = async (): Promise<Department[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return [...mockDepartments];
};

// Busca todos os Cargos
export const getRoles = async (): Promise<Role[]> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  return [...mockRoles];
};

// Busca o dicionário de proventos/descontos
export const getStandardItems = async (): Promise<StandardDictionary> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { ...standardItems };
};

// Salva um novo item no dicionário (Quando cria direto no modal)
export const addStandardItem = async (name: string, type: 'earnings' | 'deductions'): Promise<DictionaryItem> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const newItem = { 
    id: Math.random().toString(36).substr(2, 9), 
    name 
  };
  
  standardItems[type].push(newItem);
  
  return newItem;
};

// Adicione isto no final do seu departmentsRolesService.ts

export const saveDepartment = async (data: Partial<Department>): Promise<Department> => {
  await new Promise(resolve => setTimeout(resolve, 600)); // Simula o delay da internet

  if (data.id) {
    // EDIÇÃO: Atualiza o departamento existente
    const index = mockDepartments.findIndex(d => d.id === data.id);
    if (index === -1) throw new Error('Departamento não encontrado');
    
    mockDepartments[index] = { ...mockDepartments[index], ...data } as Department;
    return mockDepartments[index];
  } else {
    // CRIAÇÃO: Adiciona um novo departamento
    const newDept: Department = {
      ...data,
      id: Math.random().toString(36).substr(2, 9), // Gera um ID falso
      collaborators: 0,
      active: 0,
      rolesCount: 0,
    } as Department;
    
    mockDepartments.push(newDept);
    return newDept;
  }
};

export const saveRole = async (data: Partial<Role>): Promise<Role> => {
  await new Promise(resolve => setTimeout(resolve, 600)); // Simula o delay da API

  if (data.id) {
    // EDIÇÃO: Atualiza o cargo existente
    const index = mockRoles.findIndex(r => r.id === data.id);
    if (index === -1) throw new Error('Cargo não encontrado');
    
    mockRoles[index] = { ...mockRoles[index], ...data } as Role;
    return mockRoles[index];
  } else {
    // CRIAÇÃO: Cria um novo cargo
    const newRole: Role = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      occupants: 0,
      // Se não vier deptSigla do formulário, a gente pode extrair ou deixar um padrão provisório
      deptSigla: data.deptSigla || 'NOVO', 
    } as Role;
    
    mockRoles.push(newRole);
    return newRole;
  }
};