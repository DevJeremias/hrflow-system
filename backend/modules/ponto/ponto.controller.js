// Camada HTTP do ponto: lê o que a requisição traz, chama o serviço e escreve a resposta. As regras
// ficam em ponto.service.js.
const service = require('./ponto.service');
const { ErroDePonto } = require('./ponto.erros');
const { responderErro } = require('../../utils/erros');

const STATUS_POR_TIPO = { proibido: 403, invalido: 400, inexistente: 404, conflito: 409 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra é 500 com a mensagem do
// endpoint. `traduzirBanco` também converte falhas conhecidas do MySQL em 4xx/503 (utils/erros.js).
const responderFalha = (res, erro, mensagem500, { traduzirBanco = false } = {}) => {
    if (erro instanceof ErroDePonto) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    if (traduzirBanco) return responderErro(res, erro, mensagem500);
    console.error(`${mensagem500}:`, erro);
    return res.status(500).json({ erro: mensagem500 });
};

exports.registrarPonto = async (req, res) => {
    try {
        // SEGURANÇA: empresa e colaborador vêm do token criptografado, não do req.body
        const { empresa_id, funcionario_id } = req.usuario;
        const registro = await service.registrarPonto({ empresaId: empresa_id, funcionarioId: funcionario_id, corpo: req.body });
        res.status(201).json(registro);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao salvar o registro de ponto.');
    }
};

exports.listarPontosHoje = async (req, res) => {
    try {
        const registros = await service.listarPontosHoje({
            empresaId: req.usuario.empresa_id,
            funcionarioId: req.params.funcionarioId,
        });
        res.json(registros);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar pontos de hoje.');
    }
};

exports.listarHistorico = async (req, res) => {
    try {
        const dias = await service.listarHistorico({
            empresaId: req.usuario.empresa_id,
            funcionarioId: req.params.funcionarioId,
            mes: req.query.mes,
        });
        res.json(dias);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar histórico.');
    }
};

exports.listarTotais = (req, res) => {
    res.json(service.listarTotais());
};

exports.listarPontos = async (req, res) => {
    try {
        res.json(await service.listarPontosDaEmpresa({ empresaId: req.usuario.empresa_id }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar os registros.');
    }
};

exports.enviarJustificativa = async (req, res) => {
    try {
        const { empresa_id, funcionario_id } = req.usuario;
        const { data } = req.dadosValidados.params;
        const { texto } = req.dadosValidados.body;
        const justificativa = await service.enviarJustificativa({ empresaId: empresa_id, funcionarioId: funcionario_id, data, texto });
        res.json(justificativa);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao salvar a justificativa.', { traduzirBanco: true });
    }
};

exports.listarJustificativas = async (req, res) => {
    try {
        const { mes, funcionarioId } = req.dadosValidados.query;
        res.json(await service.listarJustificativas({ empresaId: req.usuario.empresa_id, mes, funcionarioId }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar as justificativas.', { traduzirBanco: true });
    }
};
