// Máscaras dos campos numéricos do cadastro. O que se digita ganha a pontuação enquanto se digita;
// a API aceita com ou sem ela e grava só os dígitos, então a máscara é só de leitura.
export const somenteDigitos = (valor: string): string => valor.replace(/\D/g, '');

// Aplica o molde (cada # é um dígito) aos dígitos que já existem, sem pontuação sobrando no fim.
const aplicar = (valor: string, molde: string): string => {
  const digitos = somenteDigitos(valor).slice(0, (molde.match(/#/g) ?? []).length);
  let posicao = 0;
  let saida = '';
  for (const caractere of molde) {
    if (posicao >= digitos.length) break;
    saida += caractere === '#' ? digitos[posicao++] : caractere;
  }
  return saida;
};

export const mascaraCpf = (valor: string): string => aplicar(valor, '###.###.###-##');
export const mascaraCnpj = (valor: string): string => aplicar(valor, '##.###.###/####-##');
export const mascaraCep = (valor: string): string => aplicar(valor, '#####-###');
export const mascaraPis = (valor: string): string => aplicar(valor, '###.#####.##-#');

// A máscara de cada campo do formulário de colaborador que a tem.
export const MASCARAS_DO_COLABORADOR: Record<string, (valor: string) => string> = {
  cpf: mascaraCpf,
  pis: mascaraPis,
  cep: mascaraCep,
};
