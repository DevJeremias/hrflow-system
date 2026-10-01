// Fixtures sintéticas para desenvolvimento: duas empresas fictícias, com usuários e
// funcionários cujos ids diferem por construção (nenhum usuario.id coincide com o
// funcionario.id vinculado). Dados inventados; e-mails no domínio reservado .invalid.
// Departamentos e cargos vêm do trigger de empresa nova (migration 0002).
const bcrypt = require('bcryptjs');

const EMPRESAS = ['Empresa Ficticia Alfa Ltda', 'Empresa Ficticia Beta Ltda'];

const funcionarioDe = async (conexao, empresaId, sigla, cargoNome, dados) => {
    const [[departamento]] = await conexao.query('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresaId, sigla]);
    const [[cargo]] = await conexao.query('SELECT id FROM cargos WHERE empresa_id = ? AND nome = ?', [empresaId, cargoNome]);
    const [resultado] = await conexao.query(
        `INSERT INTO funcionarios (nome, cpf, email, data_admissao, tipo_contrato, salario_base, cargo_id, departamento_id, empresa_id)
         VALUES (?, ?, ?, ?, 'CLT', ?, ?, ?, ?)`,
        [dados.nome, dados.cpf, dados.email, dados.admissao, dados.salario, cargo.id, departamento.id, empresaId]
    );
    return resultado.insertId;
};

const usuarioDe = (conexao, empresaId, funcionarioId, perfil, nome, email, senhaHash) =>
    conexao.query(
        'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
        [nome, email, senhaHash, perfil, empresaId, funcionarioId]
    );

const pontosDeOntem = (conexao, funcionarioId, empresaId) =>
    conexao.query(
        `INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES
         (?, ?, 'Entrada', CURDATE() - INTERVAL 1 DAY + INTERVAL 8 HOUR),
         (?, ?, 'Pausa Almoço', CURDATE() - INTERVAL 1 DAY + INTERVAL 12 HOUR),
         (?, ?, 'Retorno Almoço', CURDATE() - INTERVAL 1 DAY + INTERVAL 13 HOUR),
         (?, ?, 'Saída', CURDATE() - INTERVAL 1 DAY + INTERVAL 17 HOUR)`,
        [funcionarioId, empresaId, funcionarioId, empresaId, funcionarioId, empresaId, funcionarioId, empresaId]
    );

// Devolve false quando as fixtures já estavam carregadas.
const carregarFixtures = async (conexao, { senha }) => {
    const [existentes] = await conexao.query('SELECT id FROM empresas WHERE nome IN (?)', [EMPRESAS]);
    if (existentes.length > 0) return false;

    const senhaHash = await bcrypt.hash(senha, 10);
    const empresaIds = [];
    for (const nome of EMPRESAS) {
        empresaIds.push((await conexao.query('INSERT INTO empresas (nome) VALUES (?)', [nome]))[0].insertId);
    }
    const [alfa, beta] = empresaIds;

    const rhAlfa = await funcionarioDe(conexao, alfa, 'RH', 'Analista de RH',
        { nome: 'Rita RH Ficticia', cpf: '000.000.000-01', email: 'rita.rh@alfa.exemplo.invalid', admissao: '2023-02-01', salario: 5200 });
    const colaboradorAlfa = await funcionarioDe(conexao, alfa, 'TI', 'Desenvolvedor(a)',
        { nome: 'Caio Colaborador Ficticio', cpf: '000.000.000-02', email: 'caio@alfa.exemplo.invalid', admissao: '2024-03-04', salario: 6800 });
    const colaboradoraAlfa = await funcionarioDe(conexao, alfa, 'FIN', 'Assistente Administrativo',
        { nome: 'Dora Colaboradora Ficticia', cpf: '000.000.000-03', email: 'dora@alfa.exemplo.invalid', admissao: '2024-08-12', salario: 2900 });
    const colaboradoraBeta = await funcionarioDe(conexao, beta, 'TI', 'Desenvolvedor(a)',
        { nome: 'Eva Externa Ficticia', cpf: '000.000.000-04', email: 'eva@beta.exemplo.invalid', admissao: '2022-11-07', salario: 7400 });

    // Os administradores entram primeiro e não têm funcionário: é o que desloca os ids de usuarios.
    await usuarioDe(conexao, alfa, null, 'Administrador', 'Admin Alfa Ficticio', 'admin@alfa.exemplo.invalid', senhaHash);
    await usuarioDe(conexao, beta, null, 'Administrador', 'Admin Beta Ficticio', 'admin@beta.exemplo.invalid', senhaHash);
    await usuarioDe(conexao, alfa, rhAlfa, 'RH', 'Rita RH Ficticia', 'rita.rh@alfa.exemplo.invalid', senhaHash);
    await usuarioDe(conexao, alfa, colaboradorAlfa, 'Colaborador', 'Caio Colaborador Ficticio', 'caio@alfa.exemplo.invalid', senhaHash);
    await usuarioDe(conexao, alfa, colaboradoraAlfa, 'Colaborador', 'Dora Colaboradora Ficticia', 'dora@alfa.exemplo.invalid', senhaHash);
    await usuarioDe(conexao, beta, colaboradoraBeta, 'Colaborador', 'Eva Externa Ficticia', 'eva@beta.exemplo.invalid', senhaHash);

    await pontosDeOntem(conexao, colaboradorAlfa, alfa);
    await pontosDeOntem(conexao, colaboradoraBeta, beta);
    return true;
};

module.exports = { carregarFixtures };
