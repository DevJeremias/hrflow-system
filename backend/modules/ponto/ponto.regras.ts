// Regras do registro de ponto que não dependem do banco: sequência das marcações e coordenadas.
export const TIPOS = ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída'] as const;

export type TipoRegistro = typeof TIPOS[number];

// Cada validação devolve { dados } quando aceita a entrada e { erro } com a mensagem para o
// usuário quando recusa; 'erro' in resultado separa os dois casos.
export type Validacao<T> = { dados: T } | { erro: string };

export interface Coordenadas {
    latitude: number | null;
    longitude: number | null;
}

// Tipos aceitos depois de cada marcação do dia. A pausa de almoço é opcional (Entrada pode
// ir direto para Saída), mas uma vez iniciada exige o retorno. Saída encerra o dia.
const PROXIMOS: Record<TipoRegistro, readonly TipoRegistro[]> = {
    'Entrada': ['Pausa Almoço', 'Saída'],
    'Pausa Almoço': ['Retorno Almoço'],
    'Retorno Almoço': ['Saída'],
    'Saída': [],
};

export const proximosPermitidos = (ultimoTipo: TipoRegistro | null): readonly TipoRegistro[] => (
    ultimoTipo ? PROXIMOS[ultimoTipo] : ['Entrada']
);

export const validarTipo = (tipo: unknown): Validacao<TipoRegistro> => {
    if (typeof tipo !== 'string' || !(TIPOS as readonly string[]).includes(tipo)) {
        return { erro: `Tipo de registro inválido. Use um destes: ${TIPOS.join(', ')}.` };
    }
    return { dados: tipo as TipoRegistro };
};

export const LIMITE_OBSERVACAO = 255;

export const validarObservacao = (observacao: unknown): Validacao<string> => {
    if (observacao === undefined || observacao === null) return { dados: '' };
    if (typeof observacao !== 'string') return { erro: 'A observação deve ser um texto.' };
    if (observacao.length > LIMITE_OBSERVACAO) {
        return { erro: `A observação deve ter no máximo ${LIMITE_OBSERVACAO} caracteres.` };
    }
    return { dados: observacao };
};

const ehNumeroFinito = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor);

// Coordenadas são opcionais, mas vêm em par: latitude em [-90, 90] e longitude em [-180, 180],
// como números JSON (texto como "-1.45" é recusado para não aceitar lixo como "1e3" ou " ").
export const validarCoordenadas = ({ latitude, longitude }: { latitude?: unknown; longitude?: unknown }): Validacao<Coordenadas> => {
    const semLatitude = latitude === undefined || latitude === null;
    const semLongitude = longitude === undefined || longitude === null;
    if (semLatitude && semLongitude) return { dados: { latitude: null, longitude: null } };
    if (semLatitude || semLongitude) {
        return { erro: 'Informe latitude e longitude juntas, ou nenhuma das duas.' };
    }
    if (!ehNumeroFinito(latitude) || !ehNumeroFinito(longitude)) {
        return { erro: 'Latitude e longitude devem ser números.' };
    }
    if (latitude < -90 || latitude > 90) return { erro: 'Latitude fora do intervalo válido (-90 a 90).' };
    if (longitude < -180 || longitude > 180) return { erro: 'Longitude fora do intervalo válido (-180 a 180).' };
    return { dados: { latitude, longitude } };
};
