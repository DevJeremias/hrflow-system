import { z, campo } from './comum.ts';
import { LIMITE_PADRAO, LIMITE_MAXIMO, PAGINA_MAXIMA } from '../utils/paginacao.ts';

const inteiroDaQuery = (rotulo: string, minimo: number, maximo: number, padrao: number) => campo((valor) => {
    if (valor === undefined || valor === '') return { valor: padrao };
    const numero = typeof valor === 'string' && /^\d{1,9}$/.test(valor) ? Number(valor) : NaN;
    return numero >= minimo && numero <= maximo
        ? { valor: numero }
        : { erro: `${rotulo} deve ser um número inteiro entre ${minimo} e ${maximo}.` };
});

export const paginacao = z.object({
    pagina: inteiroDaQuery('pagina', 1, PAGINA_MAXIMA, 1),
    limite: inteiroDaQuery('limite', 1, LIMITE_MAXIMO, LIMITE_PADRAO),
});
