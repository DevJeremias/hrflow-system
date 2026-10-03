const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');
const db = require('../config/db');
// Direto do arquivo, não do index do módulo: o index monta o router de auth, que importa este middleware.
const { lerTokenDaSessao, csrfValido, encerrarSessao } = require('../modules/auth/auth.sessao.ts');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = async (req, res, next) => {
    // 1. O crachá vem no cookie HttpOnly da sessão (modules/auth/auth.sessao.ts)
    const token = lerTokenDaSessao(req);

    if (!token) {
        return res.status(401).json({ erro: 'Acesso negado. Nenhuma sessão foi encontrada.' });
    }

    let verified;
    try {
        // 2. Valida o crachá usando a chave secreta validada na subida
        verified = jwt.verify(token, jwtSecret);
    } catch (erro) {
        // Se cair aqui, é porque o crachá expirou ou foi corrompido
        console.error("Erro na verificação do Token:", erro.message);
        encerrarSessao(req, res);
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }

    // 3. O cookie vai sozinho em qualquer requisição, inclusive as disparadas por outro site:
    // quem muda estado precisa provar que veio do front-end devolvendo o token CSRF.
    if (!METODOS_SEGUROS.has(req.method) && !csrfValido(req, token)) {
        return res.status(403).json({ erro: 'Requisição recusada: token CSRF ausente ou inválido.' });
    }

    try {
        // 4. Assinatura válida não basta: o usuário precisa continuar existindo, o funcionário
        // vinculado não pode estar inativo e a versão da sessão tem que ser a do token.
        const [linhas] = await db.query(
            `SELECT u.sessao_versao, f.status AS funcionario_status
             FROM usuarios u
             LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             WHERE u.id = ?`,
            [verified.id]
        );
        const atual = linhas[0];
        if (!atual || atual.sessao_versao !== verified.sv || atual.funcionario_status === 'Inativo') {
            encerrarSessao(req, res);
            return res.status(401).json({ erro: 'Sessão encerrada. Faça login novamente.' });
        }

        // 5. Se for válido, guarda os dados do utilizador e deixa passar para a rota
        req.usuario = verified;
        next();
    } catch (erro) {
        console.error("Erro ao conferir a sessão:", erro);
        return res.status(500).json({ erro: 'Erro ao validar a sessão.' });
    }
};
