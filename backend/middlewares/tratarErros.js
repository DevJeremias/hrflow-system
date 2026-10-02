const { responderErro } = require('../utils/erros');

// Último middleware da aplicação: o que escapar dos controllers e dos parsers de corpo sai
// como JSON em pt-BR, em vez da página HTML padrão do Express.
const tratarErros = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err.type === 'entity.too.large') {
        return res.status(413).json({ erro: 'O corpo da requisição excede o limite permitido.' });
    }
    if (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
        return res.status(400).json({ erro: 'Corpo da requisição inválido. Envie um JSON válido.' });
    }
    return responderErro(res, err, 'Erro interno do servidor.');
};

module.exports = tratarErros;
