import { z, data, corpo, enumerado, inteiroPositivo, opcional, campo, ausente, textoLivre } from '../../shared/schemas/comum.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';
import { mesValido } from '../../shared/utils/fuso.ts';

export const LIMITE_JUSTIFICATIVA = 1000;
export const LIMITE_BUSCA = 100;
export const LIMITE_RESPOSTA = 500;

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

const mes = campo((valor: unknown) => (mesValido(valor)
    ? { valor }
    : { erro: 'Informe o mês no formato AAAA-MM (ex.: 2026-03).' }));

// O dia só pode ser o de hoje ou anterior, mas "hoje" é o da empresa: o serviço confere (ponto.service.ts).
export const diaDaJustificativa = z.object({ data: data('Data da justificativa', () => '9999-12-31', 'o ano 9999') });
export const enviarJustificativa = corpo({ texto: textoDaJustificativa });
export const consultarJustificativas = z.object({
    mes,
    funcionarioId: opcional(inteiroPositivo('Colaborador')),
    status: opcional(enumerado('O status', ['pendente', 'aprovada', 'recusada'])),
});
export const idDaJustificativa = z.object({ id: inteiroPositivo('Justificativa') });
// A recusa sem motivo é recusada pelo serviço (ponto.regras.ts), que conhece a decisão inteira.
export const decidirJustificativa = corpo({
    status: enumerado('A decisão', ['aprovada', 'recusada']),
    resposta: opcional(textoLivre('A resposta', LIMITE_RESPOSTA)),
});
// O mês é obrigatório: sem ele a consulta varreria todo o histórico da empresa.
export const consultarPontosDaEmpresa = z.object({
    mes,
    funcionarioId: opcional(inteiroPositivo('Colaborador')),
    busca: opcional(textoLivre('A busca', LIMITE_BUSCA)),
    ...paginacao.shape,
});

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface DiaDaJustificativa {
    data: string;
}

export interface CorpoDaJustificativa {
    texto: string;
}

export interface ConsultaDeJustificativas {
    mes: string;
    funcionarioId: number | null;
    status: 'pendente' | 'aprovada' | 'recusada' | null;
}

export interface IdDaJustificativa {
    id: number;
}

export interface DecisaoRecebida {
    status: 'aprovada' | 'recusada';
    resposta: string | null;
}

export interface ConsultaDePontosDaEmpresa {
    mes: string;
    funcionarioId: number | null;
    busca: string | null;
    pagina: number;
    limite: number;
}
