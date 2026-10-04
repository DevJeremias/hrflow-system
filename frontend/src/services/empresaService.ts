import httpClient from './httpClient.ts';

export const REGIMES_TRIBUTARIOS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'] as const;

export interface Company {
  nome: string;
  razao_social: string | null;
  // Só os 14 dígitos.
  cnpj: string | null;
  regime_tributario: typeof REGIMES_TRIBUTARIOS[number] | null;
  // Fuso IANA ('America/Manaus'): o dia do ponto e o mês da folha da empresa seguem ele.
  fuso: string;
  // O encarregado pelo tratamento de dados pessoais (LGPD), que os colaboradores veem no perfil.
  encarregado_nome: string | null;
  encarregado_email: string | null;
}

export interface CompanyData {
  razao_social: string;
  cnpj: string;
  regime_tributario: Company['regime_tributario'];
  fuso: string;
  // Os dois vão juntos; vazios apagam o encarregado.
  encarregado_nome: string;
  encarregado_email: string;
}

const API_URL = '/empresa';

export const getCompany = (): Promise<Company> =>
  httpClient<Company>(API_URL, { auth: true, errorMessage: 'Erro ao buscar os dados da empresa' });

export const saveCompany = (data: CompanyData): Promise<Company> =>
  httpClient<Company>(API_URL, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(data),
    errorMessage: (response) => response?.erro || 'Erro ao salvar os dados da empresa'
  });
