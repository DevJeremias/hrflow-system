import { z, data, corpo, inteiroPositivo, opcional, campo, ausente, textoLivre } from '../../schemas/comum.js';
import { paginacao } from '../../schemas/paginacao.js';
import * as fuso from './ponto.fuso.ts';

export const LIMITE_JUSTIFICATIVA = 1000;
export const LIMITE_BUSCA = 100;

const hojeEmBelem = (): string => fuso.diaLocal(Math.floor(Date.now() / 1000));

// Justificativa em branco não vale: o front mostraria "enviado" sem que o RH recebesse nada.
const textoDaJustificativa = campo((valor: unknown) => {
    if (ausente(valor)) return { erro: 'Informe o texto da justificativa.' };
    if (typeof valor !== 'string') return { erro: 'A justificativa deve ser um texto.' };
    const limpo = valor.trim();
    if (limpo.length > LIMITE_JUSTIFICATIVA) {
        return { erro: `A justificativa deve ter no máximo ${LIMITE_JUSTIFICATIVA} caracteres.` };
    }
    if (limpo.includes('\u0000')) return { erro: 'A justificativa contém caracteres inválidos.' };
    return { valor: limpo };
});

const mes = campo((valor: unknown) => (fuso.mesValido(valor)
    ? { valor }
    : { erro: 'Informe o mês no formato AAAA-MM (ex.: 2026-03).' }));

export const diaDaJustificativa = z.object({ data: data('Data da justificativa', hojeEmBelem, 'hoje') });
export const enviarJustificativa = corpo({ texto: textoDaJustificativa });
export const consultarJustificativas = z.object({
    mes,
    funcionarioId: opcional(inteiroPositivo('Colaborador')),
});
// O mês é obrigatório: sem ele a consulta varreria todo o histórico da empresa.
export const consultarPontosDaEmpresa = z.object({
    mes,
    funcionarioId: opcional(inteiroPositivo('Colaborador')),
    busca: opcional(textoLivre('A busca', LIMITE_BUSCA)),
    ...paginacao.shape,
});

// O que cada schema entrega em req.dadosValidados. schemas/comum.js ainda é JavaScript e seus
// construtores não declaram o tipo que devolvem, então estes tipos são escritos à mão: mude-os
// junto com o schema.
export interface DiaDaJustificativa {
    data: string;
}

export interface CorpoDaJustificativa {
    texto: string;
}

export interface ConsultaDeJustificativas {
    mes: string;
    funcionarioId: number | null;
}

export interface ConsultaDePontosDaEmpresa {
    mes: string;
    funcionarioId: number | null;
    busca: string | null;
    pagina: number;
    limite: number;
}
