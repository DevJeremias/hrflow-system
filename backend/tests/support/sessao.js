// A sessão viaja em cookie (modules/auth/auth.sessao.ts). Estes helpers montam os cabeçalhos que o navegador
// mandaria: o cookie da sessão e, para o front-end, o token CSRF no cabeçalho.
// Cria um usuário real e devolve um token como o login o emitiria. O authMiddleware confere o
// usuário no banco (existência, versão da sessão, funcionário ativo), então token forjado
// à mão, sem linha em usuarios, não autentica mais.
const { emitirToken, tokenCsrf, COOKIE_SESSAO, CABECALHO_CSRF } = require('../../modules/auth/auth.sessao.ts');

let contador = 0;

/**
 * @param {any} pool
 * @param {{ empresaId: number, perfil: string, funcionarioId?: number | null, senhaHash?: string }} opcoes
 */
const criarUsuario = async (pool, { empresaId, perfil, funcionarioId = null, senhaHash = 'hash-ficticio' }) => {
    const email = `usuario${process.pid}-${++contador}@exemplo.invalid`;
    const [r] = await pool.query(
        'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
        [`Usuario Ficticio ${contador}`, email, senhaHash, perfil, empresaId, funcionarioId]
    );
    const [[usuario]] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [r.insertId]);
    return { usuario, token: emitirToken(usuario, usuario.nome) };
};

// Cabeçalhos de uma requisição autenticada vinda do front-end. Sem token, nenhum cabeçalho.
/** @type {(token?: string | null) => Record<string, string>} */
const cabecalhosDaSessao = (token) => (token ? {
    Cookie: `${COOKIE_SESSAO}=${token}`,
    [CABECALHO_CSRF]: tokenCsrf(token),
} : {});

// O token que a resposta do login entregou no Set-Cookie da sessão (undefined se não entregou).
const tokenDaResposta = (resposta) => {
    for (const linha of resposta.headers.getSetCookie()) {
        const [par] = linha.split(';');
        const [nome, valor] = par.split('=');
        if (nome === COOKIE_SESSAO && valor) return valor;
    }
    return undefined;
};

module.exports = { criarUsuario, cabecalhosDaSessao, tokenDaResposta };
