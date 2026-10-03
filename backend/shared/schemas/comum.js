// Blocos compartilhados pelos schemas das rotas. Cada rota declara um único schema zod por
// parte da requisição (params, body, query) e o middleware validarEntrada o executa.
// As regras de texto, e-mail e senha são as de modules/auth/auth.schemas.ts, para que cadastro,
// login e as demais rotas recusem a mesma entrada com a mesma mensagem.
const { z } = require('zod');
const { validarTexto, validarEmail, validarSenhaDeRegistro } = require('../../modules/auth/auth.schemas.ts');

const ID_MAXIMO = 2147483647; // INT do MySQL
const VALOR_MAXIMO = '99999999.99'; // DECIMAL(10, 2)
const DATA_MINIMA = '1900-01-01';

// Campo cuja regra devolve { erro } ou { valor }: o erro vira um issue com a mensagem pronta.
// O preprocess é necessário: sem ele o zod recusa a chave ausente ("expected nonoptional")
// antes de a regra rodar, e a mensagem acionável se perde.
const campo = (processar) => z.preprocess((valor) => valor, z.unknown().transform((valor, ctx) => {
    const { erro, valor: saida } = processar(valor);
    if (erro) {
        ctx.issues.push({ code: 'custom', message: erro, input: valor });
        return z.NEVER;
    }
    return saida;
}));

const ausente = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

// Os formulários enviam '' para o que ficou em branco: ausente, null e '' viram null.
const opcional = (schema) => z.preprocess((valor) => (ausente(valor) ? null : valor), schema.nullable());

const texto = (rotulo, maximo) => campo((valor) => {
    const erro = ausente(valor) ? `${rotulo} é obrigatório.` : validarTexto(valor, rotulo, maximo);
    return erro ? { erro } : { valor: valor.trim() };
});

// Texto de uma ou mais linhas (descrição, endereço): só o tamanho é limitado.
const textoLivre = (rotulo, maximo) => campo((valor) => {
    if (typeof valor !== 'string') return { erro: `${rotulo} deve ser um texto.` };
    const limpo = valor.trim();
    if (limpo.length > maximo) return { erro: `${rotulo} deve ter no máximo ${maximo} caracteres.` };
    if (limpo.includes('\u0000')) return { erro: `${rotulo} contém caracteres inválidos.` };
    return { valor: limpo };
});

const email = campo((valor) => {
    const erro = ausente(valor) ? 'E-mail é obrigatório.' : validarEmail(valor);
    return erro ? { erro } : { valor: valor.trim().toLowerCase() };
});

const senhaNova = campo((valor) => {
    const erro = ausente(valor) ? 'Senha é obrigatória.' : validarSenhaDeRegistro(valor);
    return erro ? { erro } : { valor };
});

const inteiroPositivo = (rotulo) => campo((valor) => {
    if (ausente(valor)) return { erro: `${rotulo} é obrigatório.` };
    const numero = typeof valor === 'string' && /^\d{1,10}$/.test(valor.trim()) ? Number(valor) : valor;
    return Number.isInteger(numero) && numero >= 1 && numero <= ID_MAXIMO
        ? { valor: numero }
        : { erro: `${rotulo} deve ser um número inteiro positivo.` };
});

// Aceita número ou texto decimal ("3500", "3500.50"), nunca notação científica nem mais de 2 casas.
const dinheiro = (rotulo) => campo((valor) => {
    const representacao = typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim() : '';
    return /^\d{1,8}(\.\d{1,2})?$/.test(representacao)
        ? { valor: Number(representacao) }
        : { erro: `${rotulo} deve ser um número entre 0 e ${VALOR_MAXIMO}, com no máximo 2 casas decimais.` };
});

const dataCalendario = (texto) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!partes) return false;
    const [ano, mes, dia] = partes.slice(1).map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
};

const hoje = () => new Date().toISOString().slice(0, 10);

// Data AAAA-MM-DD real, entre 1900-01-01 e o limite informado (as datas ISO ordenam como texto).
const data = (rotulo, limiteMaximo, descricaoDoLimite) => campo((valor) => {
    if (typeof valor !== 'string' || !dataCalendario(valor.trim())) {
        return { erro: `${rotulo} deve ser uma data válida no formato AAAA-MM-DD.` };
    }
    const dia = valor.trim();
    if (dia < DATA_MINIMA || dia > limiteMaximo()) return { erro: `${rotulo} deve estar entre 1900-01-01 e ${descricaoDoLimite}.` };
    return { valor: dia };
});

// Texto que precisa casar com um formato; `dica` completa "<rotulo> deve ...".
const padrao = (regex, rotulo, dica) => campo((valor) => {
    if (typeof valor !== 'string') return { erro: `${rotulo} deve ser um texto.` };
    const limpo = valor.trim();
    return regex.test(limpo) ? { valor: limpo } : { erro: `${rotulo} deve ${dica}.` };
});

const telefone = padrao(/^[0-9()+\-.\s]{8,20}$/, 'Telefone', 'ter de 8 a 20 caracteres, só com números, espaços e ()+-.');

const enumerado = (rotulo, valores) => z.enum(valores, {
    error: () => `${rotulo} deve ser um destes valores: ${valores.join(', ')}.`,
});

// O corpo ausente ou que não é objeto (o parser deixa req.body indefinido sem JSON) recebe uma mensagem própria.
const corpo = (formato) => z.object(formato, { error: 'Envie os dados em JSON.' });

// Como `corpo`, mas recusa chave fora do formato: o que o zod descartaria em silêncio vira 400,
// para o chamador não achar que um dado foi gravado quando a API o ignorou.
const corpoEstrito = (formato) => z.strictObject(formato, {
    error: (issue) => (issue.code === 'unrecognized_keys'
        ? `Campo desconhecido: ${issue.keys.join(', ')}.`
        : 'Envie os dados em JSON.'),
});

module.exports = {
    z, ausente, opcional, texto, textoLivre, email, senhaNova, inteiroPositivo, dinheiro, data, padrao, telefone, enumerado, corpo, corpoEstrito, hoje, campo,
};
