// Interpreta TRUST_PROXY para o `trust proxy` do Express de forma explícita.
// Sem a variável, nenhum cabeçalho X-Forwarded-For é confiável: o IP é o do socket.
// `true` é recusado porque confia em qualquer X-Forwarded-For, e um cliente poderia
// forjá-lo para escapar dos limitadores de tentativas.
const interpretarTrustProxy = (valor) => {
    if (valor === undefined || valor.trim() === '' || valor.trim().toLowerCase() === 'false') return false;

    const texto = valor.trim();
    if (texto.toLowerCase() === 'true') {
        throw new Error('TRUST_PROXY=true confia em qualquer X-Forwarded-For. Informe o número de proxies (ex.: 1) ou uma lista de sub-redes (ex.: loopback).');
    }
    if (/^\d+$/.test(texto)) return Number(texto);
    return texto;
};

module.exports = { interpretarTrustProxy };
