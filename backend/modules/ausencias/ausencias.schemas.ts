import { z, data, corpo, enumerado, inteiroPositivo, opcional, campo, ausente, textoLivre } from '../../shared/schemas/comum.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';
import { STATUS, TIPOS } from './ausencias.regras.ts';
import type { StatusDeAusencia, TipoDeAusencia } from './ausencias.regras.ts';
import { validarAnexo } from './ausencias.anexo.ts';
import type { Anexo } from './ausencias.anexo.ts';

export const LIMITE_OBSERVACAO = 1000;
export const LIMITE_RESPOSTA = 500;

// Um afastamento pode ser retroativo (o atestado chega depois) e uma férias é marcada com antecedência,
// mas nenhuma das datas passa de dois anos à frente. As regras de cada tipo ficam em ausencias.regras.ts.
const doisAnosDepois = (): string => {
    const limite = new Date();
    limite.setUTCFullYear(limite.getUTCFullYear() + 2);
    return limite.toISOString().slice(0, 10);
};

const observacao = campo((valor: unknown) => {
    if (ausente(valor)) return { erro: 'Informe o motivo da solicitação.' };
    if (typeof valor !== 'string') return { erro: 'O motivo deve ser um texto.' };
    const limpo = valor.trim();
    if (limpo.length > LIMITE_OBSERVACAO) return { erro: `O motivo deve ter no máximo ${LIMITE_OBSERVACAO} caracteres.` };
    if (limpo.includes('\u0000')) return { erro: 'O motivo contém caracteres inválidos.' };
    return { valor: limpo };
});

const anexo = z.preprocess((valor) => (valor === undefined || valor === null ? null : valor), campo((valor: unknown) => {
    if (valor === null) return { valor: null };
    const resultado = validarAnexo(valor);
    return resultado.erro === undefined ? { valor: resultado.anexo } : { erro: resultado.erro };
}));

export const solicitarAusencia = corpo({
    tipo: enumerado('O tipo', TIPOS),
    inicio: data('A data de início', doisAnosDepois, 'dois anos à frente de hoje'),
    fim: data('A data de término', doisAnosDepois, 'dois anos à frente de hoje'),
    observacao,
    anexo,
}).check((ctx) => {
    const { inicio, fim } = ctx.value as unknown as CorpoDaSolicitacao;
    if (inicio && fim && fim < inicio) {
        ctx.issues.push({ code: 'custom', message: 'A data de término não pode ser anterior à data de início.', path: ['fim'], input: fim });
    }
});

export const consultarAusencias = paginacao.extend({
    status: opcional(enumerado('O status', STATUS)),
    funcionarioId: opcional(inteiroPositivo('Colaborador')),
});

export const idDaAusencia = z.object({ id: inteiroPositivo('Solicitação') });
export const colaboradorDoSaldo = z.object({ funcionarioId: inteiroPositivo('Colaborador') });

// A recusa sem motivo é recusada pelo serviço, que conhece a decisão inteira.
export const decidirAusencia = corpo({
    status: enumerado('A decisão', ['Aprovada', 'Recusada']),
    resposta: opcional(textoLivre('A resposta', LIMITE_RESPOSTA)),
});

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface CorpoDaSolicitacao {
    tipo: TipoDeAusencia;
    inicio: string;
    fim: string;
    observacao: string;
    anexo: Anexo | null;
}

export interface ConsultaDeAusencias {
    pagina: number;
    limite: number;
    status: StatusDeAusencia | null;
    funcionarioId: number | null;
}

export interface IdDaAusencia {
    id: number;
}

export interface ColaboradorDoSaldo {
    funcionarioId: number;
}

export interface DecisaoRecebida {
    status: 'Aprovada' | 'Recusada';
    resposta: string | null;
}
