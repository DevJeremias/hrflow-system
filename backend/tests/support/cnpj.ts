// CNPJ válido para os testes, sem depender de banco nem de sessão.
// CNPJ válido (com os dois dígitos verificadores) derivado de um número: dá um CNPJ distinto por
// empresa, porque a coluna é única. Escrito à parte de modules/empresa/empresa.regras.ts de propósito.
export const cnpjDeTeste = (numero: number): string => {
    const base = `${String(numero).padStart(8, '0')}0001`;
    const digito = (digitos: string, pesos: number[]) => {
        const resto = [...digitos].reduce((soma, d, i) => soma + Number(d) * pesos[i], 0) % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    const primeiro = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const segundo = digito(base + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return `${base}${primeiro}${segundo}`;
};

let contador = 0;

// Um CNPJ válido que nenhuma outra empresa de teste usa.
export const novoCnpj = (): string => cnpjDeTeste((process.pid % 10000) * 10000 + (contador += 1));
