// Regras puras de funcionários, sem banco. A senha provisória é compartilhada com a área de
// usuários, por isso vive em shared/utils.
export { gerarSenhaProvisoria } from '../../shared/utils/senhaProvisoria.ts';

const SEPARADORES_DE_CPF = /[.\-\s]/g;

// CPF com os 11 dígitos, aceito com ou sem pontuação (000.000.000-00). Devolve só os dígitos, ou
// null se o tamanho, os dígitos verificadores ou a repetição de um único dígito não fecham.
export const normalizarCpf = (valor: string): string | null => {
    const digitos = valor.replace(SEPARADORES_DE_CPF, '');
    if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return null;

    const verificador = (base: string): number => {
        // Pesos da esquerda para a direita, de (tamanho + 1) até 2.
        const soma = [...base].reduce((total, digito, indice) => total + Number(digito) * (base.length + 1 - indice), 0);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    const primeiro = verificador(digitos.slice(0, 9));
    const segundo = verificador(digitos.slice(0, 9) + primeiro);
    return digitos.endsWith(`${primeiro}${segundo}`) ? digitos : null;
};

const PESOS_DO_PIS = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

// PIS/PASEP com os 11 dígitos, aceito com ou sem pontuação (000.00000.00-0). Devolve só os dígitos,
// ou null se o tamanho ou o dígito verificador não fecham.
export const normalizarPis = (valor: string): string | null => {
    const digitos = valor.replace(/[.\-\s]/g, '');
    if (!/^\d{11}$/.test(digitos)) return null;
    const soma = PESOS_DO_PIS.reduce((total, peso, indice) => total + peso * Number(digitos[indice]), 0);
    const resto = 11 - (soma % 11);
    return Number(digitos[10]) === (resto >= 10 ? 0 : resto) ? digitos : null;
};

export const UFS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
