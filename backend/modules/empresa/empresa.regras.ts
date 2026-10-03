// Regras dos dados da empresa que não dependem do banco.

// CNPJ com os 14 dígitos, aceito com ou sem pontuação (00.000.000/0000-00). Devolve só os dígitos,
// ou null se o tamanho, os dígitos verificadores ou a repetição de um único dígito não fecham.
export const normalizarCnpj = (valor: string): string | null => {
    const digitos = valor.replace(/[.\-/\s]/g, '');
    if (!/^\d{14}$/.test(digitos) || /^(\d)\1{13}$/.test(digitos)) return null;

    const verificador = (base: string): number => {
        // Pesos de 2 a 9, da direita para a esquerda, recomeçando no 2.
        const soma = [...base].reverse().reduce((total, digito, indice) => total + Number(digito) * ((indice % 8) + 2), 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    const primeiro = verificador(digitos.slice(0, 12));
    const segundo = verificador(digitos.slice(0, 12) + primeiro);
    return digitos.endsWith(`${primeiro}${segundo}`) ? digitos : null;
};
