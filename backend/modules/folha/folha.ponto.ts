// O que o ponto (B-15) diz de um mês e que vira evento de folha: faltas e horas extras. Funções
// puras sobre os dias já apurados por modules/ponto.
import { ehDomingo, type DiaApurado } from '../ponto/index.ts';
import type { EventosDoPonto } from './folha.regras.ts';

export interface EventosApurados {
    eventos: EventosDoPonto;
    // O colaborador bateu ponto em algum dia do mês.
    temMarcacoes: boolean;
}

// Dia depois do desligamento não conta. Hora extra em dia útil e sábado vale 50%, e em domingo 100%.
// Sem nenhuma marcação no mês não há como saber se a pessoa faltou ou se a empresa não usa o ponto:
// nesse caso nenhuma falta é descontada, em vez de descontar o mês inteiro de quem não marcou.
export const eventosDoPonto = (dias: readonly DiaApurado[], desligamento: string | null): EventosApurados => {
    const doVinculo = desligamento === null ? dias : dias.filter((dia) => dia.data <= desligamento);
    const temMarcacoes = doVinculo.some((dia) => Object.values(dia.marcas).some((marca) => marca !== null));
    let faltas = 0;
    let horasExtras50Min = 0;
    let horasExtras100Min = 0;
    for (const dia of doVinculo) {
        if (dia.statusFinal === 'falta') faltas += 1;
        if (ehDomingo(dia.data)) horasExtras100Min += dia.excedenteMin;
        else horasExtras50Min += dia.excedenteMin;
    }
    return { eventos: { faltas: temMarcacoes ? faltas : 0, horasExtras50Min, horasExtras100Min }, temMarcacoes };
};
