// Competência: o mês de referência da folha, escrito 'AAAA-MM'. Datas aqui são sempre texto
// 'AAAA-MM-DD', que ordena como data, sem passar por Date nem por fuso.
const COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const competenciaValida = (valor: unknown): valor is string => typeof valor === 'string' && COMPETENCIA.test(valor);

export const primeiroDia = (competencia: string): string => `${competencia}-01`;

export const ultimoDia = (competencia: string): string => {
    const [, ano, mes] = COMPETENCIA.exec(competencia)!;
    // O dia 0 do mês seguinte é o último deste.
    return `${competencia}-${String(new Date(Date.UTC(Number(ano), Number(mes), 0)).getUTCDate()).padStart(2, '0')}`;
};

// A competência em que o dia 'AAAA-MM-DD' cai.
export const competenciaDoDia = (dia: string): string => dia.slice(0, 7);

// 'AAAA-MM' como 'MM/AAAA', o jeito que a mensagem para o usuário escreve.
export const rotuloDaCompetencia = (competencia: string): string => `${competencia.slice(5)}/${competencia.slice(0, 4)}`;
