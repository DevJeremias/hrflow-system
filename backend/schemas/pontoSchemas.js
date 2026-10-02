const { z, data, corpo, inteiroPositivo, opcional, campo, ausente } = require('./comum');
const fuso = require('../utils/fusoPonto');

const LIMITE_JUSTIFICATIVA = 1000;

const hojeEmBelem = () => fuso.diaLocal(Math.floor(Date.now() / 1000));

// Justificativa em branco não vale: o front mostraria "enviado" sem que o RH recebesse nada.
const textoDaJustificativa = campo((valor) => {
    if (ausente(valor)) return { erro: 'Informe o texto da justificativa.' };
    if (typeof valor !== 'string') return { erro: 'A justificativa deve ser um texto.' };
    const limpo = valor.trim();
    if (limpo.length > LIMITE_JUSTIFICATIVA) {
        return { erro: `A justificativa deve ter no máximo ${LIMITE_JUSTIFICATIVA} caracteres.` };
    }
    if (limpo.includes('\u0000')) return { erro: 'A justificativa contém caracteres inválidos.' };
    return { valor: limpo };
});

const mes = campo((valor) => (fuso.mesValido(valor)
    ? { valor }
    : { erro: 'Informe o mês no formato AAAA-MM (ex.: 2026-03).' }));

module.exports = {
    LIMITE_JUSTIFICATIVA,
    diaDaJustificativa: z.object({ data: data('Data da justificativa', hojeEmBelem, 'hoje') }),
    enviarJustificativa: corpo({ texto: textoDaJustificativa }),
    consultarJustificativas: z.object({
        mes,
        funcionarioId: opcional(inteiroPositivo('Colaborador')),
    }),
};
