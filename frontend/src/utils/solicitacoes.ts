import type { SaldoDeFeriasApi, StatusDeSolicitacaoApi, TipoDeSolicitacaoApi } from '../types/api';
import { hojeNoFuso } from './ponto.ts';

export const TIPOS_DE_SOLICITACAO: readonly TipoDeSolicitacaoApi[] = ['Férias', 'Licença Médica', 'Licença Maternidade', 'Licença Paternidade', 'Acidente de Trabalho', 'Outros'];

export const STATUS_DE_SOLICITACAO: readonly StatusDeSolicitacaoApi[] = ['Pendente', 'Aprovada', 'Recusada'];

// O atestado e o boletim são a prova da licença: a API recusa o pedido sem eles.
export const ANEXO_OBRIGATORIO: readonly TipoDeSolicitacaoApi[] = ['Licença Médica', 'Acidente de Trabalho'];

// Os mesmos limites da API (backend/modules/ausencias): o formulário avisa antes de enviar, a API decide.
export const TAMANHO_MAXIMO_DO_ANEXO = 5 * 1024 * 1024;
export const DURACAO_MINIMA_DAS_FERIAS = 5;
export const DURACAO_MAXIMA_DAS_FERIAS = 30;
export const DURACAO_MAXIMA_DA_LICENCA = 365;

const TIPOS_DE_ARQUIVO: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const TIPOS_ACEITOS = new Set(Object.values(TIPOS_DE_ARQUIVO));

// O navegador às vezes não informa o tipo de um arquivo: a extensão decide nesse caso.
export const tipoDoArquivo = ({ name, type }: Pick<File, 'name' | 'type'>): string =>
  TIPOS_ACEITOS.has(type) ? type : TIPOS_DE_ARQUIVO[name.split('.').pop()?.toLowerCase() ?? ''] ?? type;

export const validarArquivo = (arquivo: Pick<File, 'name' | 'type' | 'size'>): string | null => {
  if (!TIPOS_ACEITOS.has(tipoDoArquivo(arquivo))) return 'Anexe um arquivo PDF, JPG ou PNG.';
  if (arquivo.size === 0) return 'O arquivo está vazio.';
  if (arquivo.size > TAMANHO_MAXIMO_DO_ANEXO) return 'O arquivo tem mais de 5 MB. Anexe um arquivo menor.';
  return null;
};

// Quantos dias corridos o período tem, contando o primeiro e o último; 0 se as datas não valem.
export const diasDoPeriodo = (inicio: string, fim: string): number => {
  const de = Date.parse(`${inicio}T00:00:00Z`);
  const ate = Date.parse(`${fim}T00:00:00Z`);
  return Number.isNaN(de) || Number.isNaN(ate) || ate < de ? 0 : Math.round((ate - de) / 86_400_000) + 1;
};

export interface ErrosDoPeriodo {
  inicio?: string;
  fim?: string;
}

// As regras de data que a API aplica (término depois do início; férias de 5 a 30 dias que não começam
// no passado), para o formulário mostrar o erro no campo antes de enviar.
export const validarPeriodo = (tipo: TipoDeSolicitacaoApi, inicio: string, fim: string, hoje: string = hojeNoFuso()): ErrosDoPeriodo => {
  const erros: ErrosDoPeriodo = {};
  if (!inicio) erros.inicio = 'Informe a data de início.';
  if (!fim) erros.fim = 'Informe a data de término.';
  if (!inicio || !fim) return erros;
  if (fim < inicio) {
    erros.fim = 'A data de término não pode ser anterior à data de início.';
    return erros;
  }
  const dias = diasDoPeriodo(inicio, fim);
  if (tipo === 'Férias') {
    if (inicio < hoje) erros.inicio = 'As férias precisam começar hoje ou depois.';
    else if (dias < DURACAO_MINIMA_DAS_FERIAS) erros.fim = `Cada período de férias tem no mínimo ${DURACAO_MINIMA_DAS_FERIAS} dias.`;
    else if (dias > DURACAO_MAXIMA_DAS_FERIAS) erros.fim = `Cada período de férias tem no máximo ${DURACAO_MAXIMA_DAS_FERIAS} dias.`;
  } else if (dias > DURACAO_MAXIMA_DA_LICENCA) {
    erros.fim = `O afastamento pode ter no máximo ${DURACAO_MAXIMA_DA_LICENCA} dias.`;
  }
  return erros;
};

// O conteúdo do arquivo em base64, sem o prefixo data: que o FileReader acrescenta.
export const lerComoBase64 = (arquivo: Blob): Promise<string> => new Promise((resolve, reject) => {
  const leitor = new FileReader();
  leitor.onload = () => resolve(String(leitor.result).replace(/^data:[^,]*,/, ''));
  leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo anexado.'));
  leitor.readAsDataURL(arquivo);
});

// Entrega o arquivo ao navegador como um download.
export const salvarArquivo = (conteudo: Blob, nome: string): void => {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// 'AAAA-MM-DD' como 'dd/mm/aaaa'.
export const formatarDia = (dia: string): string => dia.split('-').reverse().join('/');

export const rotuloDosDias = (dias: number): string => `${dias} ${dias === 1 ? 'dia' : 'dias'}`;

// A frase de saldo que o colaborador e o RH leem, ou null quando não há saldo a explicar.
export const avisoDoSaldo = (saldo: SaldoDeFeriasApi): string | null => {
  if (saldo.admissao === null) return 'A data de admissão não está cadastrada, então o saldo de férias não pode ser calculado.';
  if (saldo.periodosCompletos === 0) return `O primeiro período aquisitivo termina em ${formatarDia(saldo.periodoAquisitivo!.fim)}: o direito a férias nasce no dia seguinte.`;
  return null;
};
