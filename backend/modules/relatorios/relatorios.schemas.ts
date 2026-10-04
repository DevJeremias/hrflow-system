import { z, opcional, campo } from '../../shared/schemas/comum.ts';
import { mesValido } from '../../shared/utils/fuso.ts';

export const FORMATOS = ['json', 'csv', 'pdf'] as const;
export type Formato = typeof FORMATOS[number];

const mes = (rotulo: string) => campo((valor: unknown) => (mesValido(valor)
    ? { valor }
    : { erro: `${rotulo} deve estar no formato AAAA-MM (ex.: 2026-03).` }));

// Sem formato o relatório vem em JSON, que é o que as telas consomem; csv e pdf são a exportação.
const formato = campo((valor: unknown) => {
    if (valor === undefined || valor === '') return { valor: 'json' as Formato };
    return (FORMATOS as readonly unknown[]).includes(valor)
        ? { valor: valor as Formato }
        : { erro: `O formato deve ser um destes: ${FORMATOS.join(', ')}.` };
});

export const consultarHeadcount = z.object({ de: mes('O mês inicial (de)'), ate: mes('O mês final (ate)'), formato });
export const consultarAniversariantes = z.object({ mes: opcional(mes('O mês')), formato });
export const consultarCusto = z.object({ competencia: mes('A competência'), formato });
export const consultarAbsenteismo = z.object({ mes: mes('O mês'), formato });

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com o schema.
export interface ConsultaDeHeadcount {
    de: string;
    ate: string;
    formato: Formato;
}

export interface ConsultaDeAniversariantes {
    mes: string | null;
    formato: Formato;
}

export interface ConsultaDeCusto {
    competencia: string;
    formato: Formato;
}

export interface ConsultaDeAbsenteismo {
    mes: string;
    formato: Formato;
}

