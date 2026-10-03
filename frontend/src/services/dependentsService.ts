import httpClient from './httpClient.ts';

// Os dependentes que reduzem a base do IRRF do colaborador na folha (R$ 189,59 cada).
export const PARENTESCOS = ['Cônjuge', 'Filho(a)', 'Pai ou mãe', 'Outro'] as const;
export type Parentesco = typeof PARENTESCOS[number];

export interface Dependent {
  id: number;
  nome: string;
  parentesco: Parentesco;
  data_nascimento: string | null;
}

export interface NewDependent {
  nome: string;
  parentesco: Parentesco;
  data_nascimento: string | null;
}

const url = (funcionarioId: string) => `/funcionarios/${funcionarioId}/dependentes`;

export const getDependents = (funcionarioId: string): Promise<Dependent[]> =>
  httpClient<Dependent[]>(url(funcionarioId), { auth: true, errorMessage: 'Erro ao buscar os dependentes.' });

export const addDependent = (funcionarioId: string, dependente: NewDependent): Promise<Dependent> =>
  httpClient<Dependent>(url(funcionarioId), { method: 'POST', auth: true, body: JSON.stringify(dependente) });

export const removeDependent = (funcionarioId: string, dependenteId: number): Promise<void> =>
  httpClient<void>(`${url(funcionarioId)}/${dependenteId}`, { method: 'DELETE', auth: true });
