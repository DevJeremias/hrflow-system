import { z, campo } from '../../shared/schemas/comum.ts';
import { competenciaValida } from './folha.competencia.ts';

const competencia = campo((valor: unknown) => (competenciaValida(valor)
    ? { valor }
    : { erro: 'Informe a competência no formato AAAA-MM (ex.: 2026-10).' }));

export const competenciaDaRota = z.object({ competencia });
// Sem a competência a consulta não saberia de qual mês falar: não há "mês atual" implícito.
export const consultarHolerite = z.object({ competencia });

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface CompetenciaDaRota {
    competencia: string;
}

export interface ConsultaDeHolerite {
    competencia: string;
}
