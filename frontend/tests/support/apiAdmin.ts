// API falsa das telas de gestão (colaboradores, estrutura, folha), compartilhada pelos testes de componente.
export type Chamada = { metodo: string; caminho: string; corpo?: Record<string, unknown> };

export const json = (status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

export const DEPARTAMENTOS = [
  { id: 1, nome: 'Tecnologia', sigla: 'TI', descricao: null, gestor: null, total_colaboradores: 2, colaboradores_ativos: 2, total_cargos: 1 },
  { id: 2, nome: 'Recursos Humanos', sigla: 'RH', descricao: null, gestor: null, total_colaboradores: 1, colaboradores_ativos: 1, total_cargos: 1 },
];
export const CARGOS = [
  { id: 10, nome: 'Desenvolvedor(a)', departamento_id: 1, departamento_nome: 'Tecnologia', nivel: 'Pleno', salario_base: '8000.00', ocupantes: 2 },
  { id: 20, nome: 'Analista de RH', departamento_id: 2, departamento_nome: 'Recursos Humanos', nivel: null, salario_base: '0.00', ocupantes: 1 },
];
export const FUNCIONARIOS = [
  { id: 7, nome: 'Bia Ficticia', email: 'bia@exemplo.invalid', cargo_id: 10, cargo_nome: 'Desenvolvedor(a)', departamento_id: 1, departamento_nome: 'Tecnologia', nivel: 'Pleno', salario_base: '8000.00', status: 'Ativo', tipo_contrato: 'CLT' },
];
export const HOLERITE = {
  id: '7', name: 'Bia Ficticia', role: 'Desenvolvedor(a)', department: 'Tecnologia', baseSalary: 8000, totalEarnings: 0, totalDeductions: 800,
  totalGross: 8000, netSalary: 7200, employerCharges: 2000, earningsList: [], deductionsList: [{ description: 'INSS', value: 800, isPercentage: false }],
};
// A folha por competência (B-12): uma folha aberta com o holerite acima.
export const FOLHA = {
  competencia: '2026-10', status: 'aberta', processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: null,
  empresa: { razaoSocial: 'Empresa Ficticia Alfa Ltda', cnpj: '11222333000181' },
  totais: { bruto: 8000, descontos: 800, liquido: 7200, encargos: 2000 }, itens: [HOLERITE], pendencias: [],
};
export const SESSAO = { id: 1, nome: 'Rita RH', perfil: 'RH', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: null, avatar: null };

// `gravacao` responde a qualquer POST, PUT ou DELETE.
export const instalarApi = (chamadas: Chamada[], gravacao: () => Response | Promise<Response> = () => json(200, { mensagem: 'ok' })) => {
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (metodo !== 'GET') return gravacao();
    if (caminho.startsWith('/auth/sessao')) return json(200, SESSAO);
    if (caminho.startsWith('/funcionarios')) return json(200, FUNCIONARIOS, { 'X-Total-Count': String(FUNCIONARIOS.length) });
    if (caminho.startsWith('/estrutura/cargos')) return json(200, CARGOS);
    if (caminho.startsWith('/estrutura/departamentos')) return json(200, DEPARTAMENTOS);
    if (caminho.startsWith('/folha/competencias/')) return json(200, FOLHA);
    return json(404, { erro: 'rota inesperada no teste' });
  }) as typeof fetch;
};
