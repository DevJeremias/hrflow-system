import { z, campo, inteiroPositivo } from '../../shared/schemas/comum.ts';

export const LIMITE_PADRAO_DA_LISTA = 20;
export const LIMITE_MAXIMO_DA_LISTA = 100;

const limite = campo((valor: unknown) => {
    if (valor === undefined || valor === '') return { valor: LIMITE_PADRAO_DA_LISTA };
    const numero = typeof valor === 'string' && /^\d{1,3}$/.test(valor) ? Number(valor) : NaN;
    return numero >= 1 && numero <= LIMITE_MAXIMO_DA_LISTA
        ? { valor: numero }
        : { erro: `O limite deve ser um número inteiro entre 1 e ${LIMITE_MAXIMO_DA_LISTA}.` };
});

export const consultarNotificacoes = z.object({ limite });
export const idDaNotificacao = z.object({ id: inteiroPositivo('Notificação') });

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com o schema.
export interface ConsultaDeNotificacoes {
    limite: number;
}

export interface IdDaNotificacao {
    id: number;
}
