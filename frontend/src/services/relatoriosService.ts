import httpClient from './httpClient.ts';
import type { AbsenteismoApi, AniversarianteApi, CustoPorDepartamentoApi, LinhaDeHeadcountApi } from '../types/api.ts';

export type HeadcountRow = LinhaDeHeadcountApi;
export type Birthday = AniversarianteApi;
export type DepartmentCost = CustoPorDepartamentoApi;
export type Absenteeism = AbsenteismoApi;

const API_URL = '/relatorios';

export type ExportFormat = 'csv' | 'pdf';

// Cada relatório com a query que o identifica; a mesma query, com `formato`, é a exportação.
export const queryDoRelatorio = {
  headcount: (de: string, ate: string) => new URLSearchParams({ de, ate }),
  aniversariantes: (mes: string) => new URLSearchParams({ mes }),
  custoPorDepartamento: (competencia: string) => new URLSearchParams({ competencia }),
  absenteismo: (mes: string) => new URLSearchParams({ mes }),
};

const CAMINHO_DO_RELATORIO = {
  headcount: '/headcount',
  aniversariantes: '/aniversariantes',
  custoPorDepartamento: '/custo-departamento',
  absenteismo: '/absenteismo',
} as const;

export type Relatorio = keyof typeof CAMINHO_DO_RELATORIO;

// Endereço do arquivo exportado. A sessão é um cookie da mesma origem, então um link comum baixa o
// arquivo sem passar pelo httpClient (que só lê JSON).
export const enderecoDaExportacao = (relatorio: Relatorio, query: URLSearchParams, formato: ExportFormat): string => {
  const params = new URLSearchParams(query);
  params.set('formato', formato);
  return `/api${API_URL}${CAMINHO_DO_RELATORIO[relatorio]}?${params}`;
};

const buscar = async <T>(relatorio: Relatorio, query: URLSearchParams, erro: string): Promise<T> => {
  const dados = await httpClient<T>(`${API_URL}${CAMINHO_DO_RELATORIO[relatorio]}?${query}`, { auth: true, errorMessage: erro });
  if (dados === null || typeof dados !== 'object') throw new Error(`Resposta inválida ao carregar o relatório. ${erro}`);
  return dados;
};

export const relatoriosService = {
  async getHeadcount(de: string, ate: string): Promise<HeadcountRow[]> {
    const dados = await buscar<HeadcountRow[]>('headcount', queryDoRelatorio.headcount(de, ate), 'Erro ao carregar o headcount');
    if (!Array.isArray(dados)) throw new Error('Resposta inválida ao carregar o headcount');
    return dados;
  },

  async getAniversariantes(mes: string): Promise<Birthday[]> {
    const dados = await buscar<Birthday[]>('aniversariantes', queryDoRelatorio.aniversariantes(mes), 'Erro ao carregar os aniversariantes');
    if (!Array.isArray(dados)) throw new Error('Resposta inválida ao carregar os aniversariantes');
    return dados;
  },

  getCustoPorDepartamento: (competencia: string) =>
    buscar<DepartmentCost>('custoPorDepartamento', queryDoRelatorio.custoPorDepartamento(competencia), 'Erro ao carregar o custo por departamento'),

  getAbsenteismo: (mes: string) => buscar<Absenteeism>('absenteismo', queryDoRelatorio.absenteismo(mes), 'Erro ao carregar o absenteísmo'),
};
