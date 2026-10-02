// Regras do registro de ponto que não dependem do banco: sequência das marcações e coordenadas.
const TIPOS = ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída'];

// Tipos aceitos depois de cada marcação do dia. A pausa de almoço é opcional (Entrada pode
// ir direto para Saída), mas uma vez iniciada exige o retorno. Saída encerra o dia.
const PROXIMOS = {
    'Entrada': ['Pausa Almoço', 'Saída'],
    'Pausa Almoço': ['Retorno Almoço'],
    'Retorno Almoço': ['Saída'],
    'Saída': [],
};

const proximosPermitidos = (ultimoTipo) => (ultimoTipo ? PROXIMOS[ultimoTipo] : ['Entrada']);

const validarTipo = (tipo) => {
    if (typeof tipo !== 'string' || !TIPOS.includes(tipo)) {
        return { erro: `Tipo de registro inválido. Use um destes: ${TIPOS.join(', ')}.` };
    }
    return { dados: tipo };
};

const LIMITE_OBSERVACAO = 255;

const validarObservacao = (observacao) => {
    if (observacao === undefined || observacao === null) return { dados: '' };
    if (typeof observacao !== 'string') return { erro: 'A observação deve ser um texto.' };
    if (observacao.length > LIMITE_OBSERVACAO) {
        return { erro: `A observação deve ter no máximo ${LIMITE_OBSERVACAO} caracteres.` };
    }
    return { dados: observacao };
};

const ehNumeroFinito = (valor) => typeof valor === 'number' && Number.isFinite(valor);

// Coordenadas são opcionais, mas vêm em par: latitude em [-90, 90] e longitude em [-180, 180],
// como números JSON (texto como "-1.45" é recusado para não aceitar lixo como "1e3" ou " ").
const validarCoordenadas = ({ latitude, longitude }) => {
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

module.exports = { TIPOS, LIMITE_OBSERVACAO, proximosPermitidos, validarTipo, validarObservacao, validarCoordenadas };
