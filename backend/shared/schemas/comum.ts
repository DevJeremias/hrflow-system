// Blocos compartilhados pelos schemas das rotas. Cada rota declara um único schema zod por
// parte da requisição (params, body, query) e o middleware validarEntrada o executa.
// As regras de texto, e-mail e senha são as de modules/auth/auth.schemas.ts, para que cadastro,
// login e as demais rotas recusem a mesma entrada com a mesma mensagem.
import { z } from 'zod';
import { validarTexto, validarEmail, validarSenhaDeRegistro } from '../../modules/auth/auth.schemas.ts';

const ID_MAXIMO = 2147483647; // INT do MySQL
const VALOR_MAXIMO = '99999999.99'; // DECIMAL(10, 2)
const DATA_MINIMA = '1900-01-01';

// Campo cuja regra devolve { erro } ou { valor }: o erro vira um issue com a mensagem pronta.
// O preprocess é necessário: sem ele o zod recusa a chave ausente ("expected nonoptional")
// antes de a regra rodar, e a mensagem acionável se perde.
type Resultado<T> = { erro: string; valor?: undefined } | { valor: T; erro?: undefined };

export const campo = <T>(processar: (valor: unknown) => Resultado<T>) => z.preprocess((valor) => valor, z.unknown().transform((valor, ctx) => {
    const resultado = processar(valor);
    if (resultado.erro) {
        ctx.issues.push({ code: 'custom', message: resultado.erro, input: valor });
        return z.NEVER;
    }
    return resultado.valor as T;
}));

export const ausente = (valor: unknown): boolean => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

// Os formulários enviam '' para o que ficou em branco: ausente, null e '' viram null.
export const opcional = <S extends z.ZodType>(schema: S) => z.preprocess((valor) => (ausente(valor) ? null : valor), schema.nullable());

export const texto = (rotulo: string, maximo: number) => campo((valor) => {
    const erro = ausente(valor) ? `${rotulo} é obrigatório.` : validarTexto(valor, rotulo, maximo);
    return erro ? { erro } : { valor: (valor as string).trim() };
});

// Texto de uma ou mais linhas (descrição, endereço): só o tamanho é limitado.
export const textoLivre = (rotulo: string, maximo: number) => campo((valor) => {
    if (typeof valor !== 'string') return { erro: `${rotulo} deve ser um texto.` };
    const limpo = valor.trim();
    if (limpo.length > maximo) return { erro: `${rotulo} deve ter no máximo ${maximo} caracteres.` };
    if (limpo.includes('\u0000')) return { erro: `${rotulo} contém caracteres inválidos.` };
    return { valor: limpo };
});

export const email = campo((valor) => {
    const erro = ausente(valor) ? 'E-mail é obrigatório.' : validarEmail(valor);
    return erro ? { erro } : { valor: (valor as string).trim().toLowerCase() };
});

export const senhaNova = campo((valor) => {
    const erro = ausente(valor) ? 'Senha é obrigatória.' : validarSenhaDeRegistro(valor);
    return erro ? { erro } : { valor: valor as string };
});

export const inteiroPositivo = (rotulo: string) => campo((valor) => {
    if (ausente(valor)) return { erro: `${rotulo} é obrigatório.` };
    const numero = typeof valor === 'string' && /^\d{1,10}$/.test(valor.trim()) ? Number(valor) : valor;
    return typeof numero === 'number' && Number.isInteger(numero) && numero >= 1 && numero <= ID_MAXIMO
        ? { valor: numero }
        : { erro: `${rotulo} deve ser um número inteiro positivo.` };
});

// Aceita número ou texto decimal ("3500", "3500.50"), nunca notação científica nem mais de 2 casas.
export const dinheiro = (rotulo: string) => campo((valor) => {
    const representacao = typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim() : '';
    return /^\d{1,8}(\.\d{1,2})?$/.test(representacao)
        ? { valor: Number(representacao) }
        : { erro: `${rotulo} deve ser um número entre 0 e ${VALOR_MAXIMO}, com no máximo 2 casas decimais.` };
});

const dataCalendario = (texto: string): boolean => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!partes) return false;
    const [ano, mes, dia] = partes.slice(1).map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
};

export const hoje = (): string => new Date().toISOString().slice(0, 10);

// Data AAAA-MM-DD real, entre 1900-01-01 e o limite informado (as datas ISO ordenam como texto).
export const data = (rotulo: string, limiteMaximo: () => string, descricaoDoLimite: string) => campo((valor) => {
    if (typeof valor !== 'string' || !dataCalendario(valor.trim())) {
        return { erro: `${rotulo} deve ser uma data válida no formato AAAA-MM-DD.` };
    }
    const dia = valor.trim();
    if (dia < DATA_MINIMA || dia > limiteMaximo()) return { erro: `${rotulo} deve estar entre 1900-01-01 e ${descricaoDoLimite}.` };
    return { valor: dia };
});

// Texto que precisa casar com um formato; `dica` completa "<rotulo> deve ...".
export const padrao = (regex: RegExp, rotulo: string, dica: string) => campo((valor) => {
    if (typeof valor !== 'string') return { erro: `${rotulo} deve ser um texto.` };
    const limpo = valor.trim();
    return regex.test(limpo) ? { valor: limpo } : { erro: `${rotulo} deve ${dica}.` };
});

export const telefone = padrao(/^[0-9()+\-.\s]{8,20}$/, 'Telefone', 'ter de 8 a 20 caracteres, só com números, espaços e ()+-.');

export const enumerado = <const V extends readonly [string, ...string[]]>(rotulo: string, valores: V) => z.enum(valores, {
    error: () => `${rotulo} deve ser um destes valores: ${valores.join(', ')}.`,
});

// O corpo ausente ou que não é objeto (o parser deixa req.body indefinido sem JSON) recebe uma mensagem própria.
export const corpo = <T extends z.ZodRawShape>(formato: T) => z.object(formato, { error: 'Envie os dados em JSON.' });

// Como `corpo`, mas recusa chave fora do formato: o que o zod descartaria em silêncio vira 400,
// para o chamador não achar que um dado foi gravado quando a API o ignorou.
export const corpoEstrito = <T extends z.ZodRawShape>(formato: T) => z.strictObject(formato, {
    error: (issue) => (issue.code === 'unrecognized_keys'
        ? `Campo desconhecido: ${issue.keys.join(', ')}.`
        : 'Envie os dados em JSON.'),
});

export { z };
