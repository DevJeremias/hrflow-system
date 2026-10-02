// Executa os schemas zod de uma rota (params, body, query) antes do controller. Entrada
// inválida vira 400 com a primeira mensagem em `erro` (o campo que o front-end já exibe) e a
// lista completa em `detalhes`; a entrada validada e normalizada fica em req.dadosValidados.
const PARTES = ['params', 'body', 'query'];

const formatarIssues = (issues) => issues.map((issue) => ({
    campo: issue.path.join('.') || null,
    mensagem: issue.message,
}));

const validarEntrada = (schemas) => (req, res, next) => {
    const dadosValidados = {};
    const detalhes = [];

    for (const parte of PARTES) {
        if (!schemas[parte]) continue;
        const resultado = schemas[parte].safeParse(req[parte]);
        if (resultado.success) dadosValidados[parte] = resultado.data;
        else detalhes.push(...formatarIssues(resultado.error.issues));
    }

    if (detalhes.length > 0) return res.status(400).json({ erro: detalhes[0].mensagem, detalhes });

    req.dadosValidados = dadosValidados;
    next();
};

module.exports = validarEntrada;
