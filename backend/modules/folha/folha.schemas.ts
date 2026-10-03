import { z, campo, ausente, corpoEstrito, dinheiro, inteiroPositivo } from '../../shared/schemas/comum.ts';
import { competenciaValida } from './folha.competencia.ts';

const competencia = campo((valor: unknown) => (competenciaValida(valor)
    ? { valor }
    : { erro: 'Informe a competência no formato AAAA-MM (ex.: 2026-10).' }));

export const competenciaDaRota = z.object({ competencia });
export const competenciaEColaborador = z.object({ competencia, funcionarioId: inteiroPositivo('Colaborador') });
// Sem a competência a consulta não saberia de qual mês falar: não há "mês atual" implícito.
export const consultarHolerite = z.object({ competencia });

// Cada lançamento é opcional e o que falta vale zero: o corpo é o conjunto inteiro dos lançamentos do colaborador.
const lancamento = (rotulo: string) => z.preprocess((valor) => (ausente(valor) ? 0 : valor), dinheiro(rotulo));

export const lancamentosDoColaborador = corpoEstrito({
    adiantamento: lancamento('Adiantamento'),
    valeTransporte: lancamento('Vale-transporte'),
    valeRefeicao: lancamento('Vale-refeição'),
    planoSaude: lancamento('Plano de saúde'),
});

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface CompetenciaDaRota {
    competencia: string;
}

export interface ConsultaDeHolerite {
    competencia: string;
}

export interface CompetenciaEColaborador {
    competencia: string;
    funcionarioId: number;
}

export interface CorpoDosLancamentos {
    adiantamento: number;
    valeTransporte: number;
    valeRefeicao: number;
    planoSaude: number;
}
