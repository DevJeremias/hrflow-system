// As contas dos relatórios, sem banco: os meses de um período, o headcount com o turnover, o custo por
// departamento e o absenteísmo. O serviço traz os números do banco e da folha, e aqui só se calcula.
// Valores em reais circulam em centavos inteiros até o fim, como na folha, para a soma das linhas
// ser exatamente a soma do total.
import { emCentavos, emReais } from '../folha/index.ts';
import type { HoleriteDoColaborador } from '../folha/index.ts';
import type { ColaboradorApurado, DiaApurado } from '../ponto/index.ts';

export const MAXIMO_DE_MESES = 60;

// Os meses 'AAAA-MM' de `de` a `ate`, inclusive. Vazio quando `de` vem depois de `ate`.
export const mesesEntre = (de: string, ate: string): string[] => {
    const meses: string[] = [];
    let [ano, mes] = de.split('-').map(Number);
    const [anoFinal, mesFinal] = ate.split('-').map(Number);
    while (ano < anoFinal || (ano === anoFinal && mes <= mesFinal)) {
        meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
        if (mes === 12) { ano += 1; mes = 1; } else { mes += 1; }
    }
    return meses;
};

export const primeiroDiaDoMes = (mes: string): string => `${mes}-01`;

export const ultimoDiaDoMes = (mes: string): string => {
    const [ano, m] = mes.split('-').map(Number);
    return `${mes}-${String(new Date(Date.UTC(ano, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

// parte/total em percentual com uma casa; sem total não há taxa a calcular.
export const percentual = (parte: number, total: number): number => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

export interface LinhaDeHeadcount {
    mes: string;
    admitidos: number;
    desligados: number;
    // Quem estava na empresa no último dia do mês.
    ativos: number;
    // Desligamentos do mês sobre a média de ativos do começo e do fim do mês, em %.
    turnover: number;
}

// Uma linha por mês. `ativosAntes` é o headcount no fim do mês anterior ao primeiro; cada mês soma os
// admitidos e tira os desligados do anterior.
export const montarHeadcount = ({ meses, ativosAntes, admitidosPorMes, desligadosPorMes }: {
    meses: readonly string[];
    ativosAntes: number;
    admitidosPorMes: ReadonlyMap<string, number>;
    desligadosPorMes: ReadonlyMap<string, number>;
}): LinhaDeHeadcount[] => {
    let anterior = ativosAntes;
    return meses.map((mes) => {
        const admitidos = admitidosPorMes.get(mes) ?? 0;
        const desligados = desligadosPorMes.get(mes) ?? 0;
        const ativos = anterior + admitidos - desligados;
        const linha = { mes, admitidos, desligados, ativos, turnover: percentual(desligados, (anterior + ativos) / 2) };
        anterior = ativos;
        return linha;
    });
};

export interface LinhaDeCusto {
    departamento: string;
    colaboradores: number;
    bruto: number;
    descontos: number;
    liquido: number;
    encargos: number;
    // O que a folha custa à empresa: o bruto mais os encargos.
    custoTotal: number;
}

type CampoMonetario = 'bruto' | 'descontos' | 'liquido' | 'encargos';

const CAMPOS_DO_HOLERITE: Record<CampoMonetario, keyof HoleriteDoColaborador> = {
    bruto: 'totalGross', descontos: 'totalDeductions', liquido: 'netSalary', encargos: 'employerCharges',
};

const linhaDeCusto = (departamento: string, centavos: Record<CampoMonetario, number>, colaboradores: number): LinhaDeCusto => ({
    departamento,
    colaboradores,
    bruto: emReais(centavos.bruto),
    descontos: emReais(centavos.descontos),
    liquido: emReais(centavos.liquido),
    encargos: emReais(centavos.encargos),
    custoTotal: emReais(centavos.bruto + centavos.encargos),
});

// Os holerites da folha somados por departamento (o do próprio holerite, já congelado na folha), em ordem
// alfabética, e o total da empresa, que é a soma exata das linhas e portanto o da folha.
export const custoPorDepartamento = (holerites: readonly HoleriteDoColaborador[]): { linhas: LinhaDeCusto[]; total: LinhaDeCusto } => {
    const zerado = (): Record<CampoMonetario, number> => ({ bruto: 0, descontos: 0, liquido: 0, encargos: 0 });
    const grupos = new Map<string, { centavos: Record<CampoMonetario, number>; colaboradores: number }>();
    const total = { centavos: zerado(), colaboradores: 0 };

    for (const holerite of holerites) {
        const grupo = grupos.get(holerite.department) ?? { centavos: zerado(), colaboradores: 0 };
        grupo.colaboradores += 1;
        total.colaboradores += 1;
        for (const campo of Object.keys(CAMPOS_DO_HOLERITE) as CampoMonetario[]) {
            const valor = emCentavos(holerite[CAMPOS_DO_HOLERITE[campo]] as number);
            grupo.centavos[campo] += valor;
            total.centavos[campo] += valor;
        }
        grupos.set(holerite.department, grupo);
    }

    return {
        linhas: [...grupos.entries()]
            .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
            .map(([departamento, { centavos, colaboradores }]) => linhaDeCusto(departamento, centavos, colaboradores)),
        total: linhaDeCusto('Total', total.centavos, total.colaboradores),
    };
};

export interface LinhaDeAbsenteismo {
    departamento: string;
    colaboradores: number;
    // Dias úteis já apurados de todos os colaboradores do departamento: o denominador da taxa.
    diasApurados: number;
    // Dia útil sem marcação e sem justificativa aprovada.
    faltas: number;
    // Dia útil sem marcação abonado por uma justificativa aprovada.
    ausenciasJustificadas: number;
    // Dias em que o colaborador chegou depois da tolerância.
    atrasos: number;
    // (faltas + ausências justificadas) sobre os dias apurados, em %.
    taxa: number;
}

const SEM_DEPARTAMENTO = 'Sem departamento';

const semMarcacao = (dia: DiaApurado): boolean => Object.values(dia.marcas).every((marca) => marca === null);

// Dia útil que já foi apurado: fim de semana, dia aberto (hoje sem saída, futuro) e antes da admissão ficam de fora.
const foiApurado = (dia: DiaApurado): boolean => dia.statusFinal !== 'fim_de_semana' && !dia.aberto && dia.previstoMin > 0;

interface Contagem {
    colaboradores: number;
    diasApurados: number;
    faltas: number;
    ausenciasJustificadas: number;
    atrasos: number;
}

const contar = (dias: readonly DiaApurado[]): Omit<Contagem, 'colaboradores'> => {
    const apurados = dias.filter(foiApurado);
    return {
        diasApurados: apurados.length,
        faltas: apurados.filter((dia) => dia.statusFinal === 'falta').length,
        ausenciasJustificadas: apurados.filter((dia) => dia.statusFinal === 'justificado' && semMarcacao(dia)).length,
        atrasos: apurados.filter((dia) => dia.statusFinal === 'atraso').length,
    };
};

const linhaDeAbsenteismo = (departamento: string, c: Contagem): LinhaDeAbsenteismo => ({
    departamento, ...c, taxa: percentual(c.faltas + c.ausenciasJustificadas, c.diasApurados),
});

// O mês apurado de cada colaborador somado por departamento e o total da empresa.
export const absenteismoPorDepartamento = (colaboradores: readonly ColaboradorApurado[]): { linhas: LinhaDeAbsenteismo[]; total: LinhaDeAbsenteismo } => {
    const vazio = (): Contagem => ({ colaboradores: 0, diasApurados: 0, faltas: 0, ausenciasJustificadas: 0, atrasos: 0 });
    const somar = (alvo: Contagem, outra: Omit<Contagem, 'colaboradores'>) => {
        alvo.colaboradores += 1;
        alvo.diasApurados += outra.diasApurados;
        alvo.faltas += outra.faltas;
        alvo.ausenciasJustificadas += outra.ausenciasJustificadas;
        alvo.atrasos += outra.atrasos;
    };

    const grupos = new Map<string, Contagem>();
    const total = vazio();
    for (const colaborador of colaboradores) {
        const contagem = contar(colaborador.dias);
        const nome = colaborador.departamento ?? SEM_DEPARTAMENTO;
        const grupo = grupos.get(nome) ?? vazio();
        somar(grupo, contagem);
        somar(total, contagem);
        grupos.set(nome, grupo);
    }

    return {
        linhas: [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([departamento, c]) => linhaDeAbsenteismo(departamento, c)),
        total: linhaDeAbsenteismo('Total', total),
    };
};
