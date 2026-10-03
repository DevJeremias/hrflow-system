// Fixtures sintéticas para desenvolvimento: duas empresas fictícias, com usuários e
// funcionários cujos ids diferem por construção (nenhum usuario.id coincide com o
// funcionario.id vinculado). Dados inventados; e-mails no domínio reservado .invalid.
// Departamentos e cargos vêm do trigger de empresa nova (migration 0002).
import bcrypt from 'bcrypt';
import type { Connection, Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

type Executor = Connection | PoolConnection;

interface DadosDoFuncionario {
    nome: string;
    cpf: string;
    email: string;
    admissao: string;
    salario: number;
}

const EMPRESAS = ['Empresa Ficticia Alfa Ltda', 'Empresa Ficticia Beta Ltda'];
const EMAILS_FUNCIONARIOS = [
    'rita.rh@alfa.exemplo.invalid',
    'caio@alfa.exemplo.invalid',
    'dora@alfa.exemplo.invalid',
    'eva@beta.exemplo.invalid',
];
const EMAILS_USUARIOS = [
    'admin@alfa.exemplo.invalid',
    'admin@beta.exemplo.invalid',
    ...EMAILS_FUNCIONARIOS,
];

const funcionarioDe = async (conexao: Executor, empresaId: number, sigla: string, cargoNome: string, dados: DadosDoFuncionario) => {
    const [[departamento]] = await conexao.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresaId, sigla]);
    const [[cargo]] = await conexao.query<RowDataPacket[]>('SELECT id FROM cargos WHERE empresa_id = ? AND nome = ?', [empresaId, cargoNome]);
    const [resultado] = await conexao.query<ResultSetHeader>(
        `INSERT INTO funcionarios (nome, cpf, email, data_admissao, tipo_contrato, salario_base, cargo_id, departamento_id, empresa_id)
         VALUES (?, ?, ?, ?, 'CLT', ?, ?, ?, ?)`,
        [dados.nome, dados.cpf, dados.email, dados.admissao, dados.salario, cargo.id, departamento.id, empresaId]
    );
    return resultado.insertId;
};

const usuarioDe = (conexao: Executor, empresaId: number, funcionarioId: number | null, perfil: string, nome: string, email: string, senhaHash: string) =>
    conexao.query(
        'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
        [nome, email, senhaHash, perfil, empresaId, funcionarioId]
    );

const pontosDeOntem = (conexao: Executor, funcionarioId: number, empresaId: number) =>
    conexao.query(
        `INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES
         (?, ?, 'Entrada', CURDATE() - INTERVAL 1 DAY + INTERVAL 8 HOUR),
         (?, ?, 'Pausa Almoço', CURDATE() - INTERVAL 1 DAY + INTERVAL 12 HOUR),
         (?, ?, 'Retorno Almoço', CURDATE() - INTERVAL 1 DAY + INTERVAL 13 HOUR),
         (?, ?, 'Saída', CURDATE() - INTERVAL 1 DAY + INTERVAL 17 HOUR)`,
        [funcionarioId, empresaId, funcionarioId, empresaId, funcionarioId, empresaId, funcionarioId, empresaId]
    );

// Devolve false quando as fixtures já estavam carregadas e recusa estado parcial.
export const carregarFixtures = async (conexao: Connection | Pool, { senha }: { senha: string }) => {
    const db: Executor = 'getConnection' in conexao ? await conexao.getConnection() : conexao;
    let transacaoIniciada = false;
    try {
        await db.beginTransaction();
        transacaoIniciada = true;
        const [[{ empresas }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS empresas FROM empresas WHERE nome IN (?)', [EMPRESAS]);
        const [[{ funcionarios }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS funcionarios FROM funcionarios WHERE email IN (?)', [EMAILS_FUNCIONARIOS]);
        const [[{ usuarios }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS usuarios FROM usuarios WHERE email IN (?)', [EMAILS_USUARIOS]);
        const [[{ pontos }]] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS pontos FROM registro_pontos rp
             JOIN funcionarios f ON f.id = rp.funcionario_id
             WHERE f.email IN (?)`,
            [EMAILS_FUNCIONARIOS]
        );
        const presentes = [empresas, funcionarios, usuarios, pontos];
        const esperados = [EMPRESAS.length, EMAILS_FUNCIONARIOS.length, EMAILS_USUARIOS.length, 8];
        if (presentes.some((quantidade) => quantidade > 0)) {
            if (presentes.every((quantidade, indice) => indice === 3 ? quantidade >= esperados[indice] : quantidade === esperados[indice])) {
                await db.commit();
                return false;
            }
            throw new Error('Carga parcial de fixtures detectada; recrie o banco ou complete a carga antes de semear novamente.');
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const empresaIds: number[] = [];
        for (const nome of EMPRESAS) {
            empresaIds.push((await db.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', [nome]))[0].insertId);
        }
        const [alfa, beta] = empresaIds;

        const rhAlfa = await funcionarioDe(db, alfa, 'RH', 'Analista de RH',
            { nome: 'Rita RH Ficticia', cpf: '000.000.000-01', email: 'rita.rh@alfa.exemplo.invalid', admissao: '2023-02-01', salario: 5200 });
        const colaboradorAlfa = await funcionarioDe(db, alfa, 'TI', 'Desenvolvedor(a)',
            { nome: 'Caio Colaborador Ficticio', cpf: '000.000.000-02', email: 'caio@alfa.exemplo.invalid', admissao: '2024-03-04', salario: 6800 });
        const colaboradoraAlfa = await funcionarioDe(db, alfa, 'FIN', 'Assistente Administrativo',
            { nome: 'Dora Colaboradora Ficticia', cpf: '000.000.000-03', email: 'dora@alfa.exemplo.invalid', admissao: '2024-08-12', salario: 2900 });
        const colaboradoraBeta = await funcionarioDe(db, beta, 'TI', 'Desenvolvedor(a)',
            { nome: 'Eva Externa Ficticia', cpf: '000.000.000-04', email: 'eva@beta.exemplo.invalid', admissao: '2022-11-07', salario: 7400 });

        // Os administradores entram primeiro e não têm funcionário: é o que desloca os ids de usuarios.
        await usuarioDe(db, alfa, null, 'Administrador', 'Admin Alfa Ficticio', 'admin@alfa.exemplo.invalid', senhaHash);
        await usuarioDe(db, beta, null, 'Administrador', 'Admin Beta Ficticio', 'admin@beta.exemplo.invalid', senhaHash);
        await usuarioDe(db, alfa, rhAlfa, 'RH', 'Rita RH Ficticia', 'rita.rh@alfa.exemplo.invalid', senhaHash);
        await usuarioDe(db, alfa, colaboradorAlfa, 'Colaborador', 'Caio Colaborador Ficticio', 'caio@alfa.exemplo.invalid', senhaHash);
        await usuarioDe(db, alfa, colaboradoraAlfa, 'Colaborador', 'Dora Colaboradora Ficticia', 'dora@alfa.exemplo.invalid', senhaHash);
        await usuarioDe(db, beta, colaboradoraBeta, 'Colaborador', 'Eva Externa Ficticia', 'eva@beta.exemplo.invalid', senhaHash);

        await pontosDeOntem(db, colaboradorAlfa, alfa);
        await pontosDeOntem(db, colaboradoraBeta, beta);
        await db.commit();
        return true;
    } catch (erro) {
        if (transacaoIniciada) await db.rollback();
        throw erro;
    } finally {
        if (db !== conexao) (db as PoolConnection).release();
    }
};
