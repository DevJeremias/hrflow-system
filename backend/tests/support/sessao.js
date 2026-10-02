// Cria um usuário real e devolve um token como o login o emitiria. O authMiddleware confere o
// usuário no banco (existência, versão da sessão, funcionário ativo), então token forjado
// à mão, sem linha em usuarios, não autentica mais.
const { emitirToken } = require('../../utils/sessao');

let contador = 0;

const criarUsuario = async (pool, { empresaId, perfil, funcionarioId = null, senhaHash = 'hash-ficticio' }) => {
    const email = `usuario${process.pid}-${++contador}@exemplo.invalid`;
    const [r] = await pool.query(
        'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
        [`Usuario Ficticio ${contador}`, email, senhaHash, perfil, empresaId, funcionarioId]
    );
    const [[usuario]] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [r.insertId]);
    return { usuario, token: emitirToken(usuario, usuario.nome) };
};

module.exports = { criarUsuario };
