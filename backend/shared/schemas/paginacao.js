const { z, campo } = require('./comum');
const { LIMITE_PADRAO, LIMITE_MAXIMO, PAGINA_MAXIMA } = require('../utils/paginacao');

const inteiroDaQuery = (rotulo, minimo, maximo, padrao) => campo((valor) => {
    if (valor === undefined || valor === '') return { valor: padrao };
    const numero = typeof valor === 'string' && /^\d{1,9}$/.test(valor) ? Number(valor) : NaN;
    return numero >= minimo && numero <= maximo
        ? { valor: numero }
        : { erro: `${rotulo} deve ser um número inteiro entre ${minimo} e ${maximo}.` };
});

const paginacao = z.object({
    pagina: inteiroDaQuery('pagina', 1, PAGINA_MAXIMA, 1),
    limite: inteiroDaQuery('limite', 1, LIMITE_MAXIMO, LIMITE_PADRAO),
});

module.exports = { paginacao };
