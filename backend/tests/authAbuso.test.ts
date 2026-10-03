// Regressão do SEC-07 (autenticação e cadastro): limite de corpo, limitador de tentativas,
// validação antes do banco e cadastro de empresa e usuário numa única transação.
//
// Exige um MySQL real. Informe o servidor com HRFLOW_TEST_DB_HOST, HRFLOW_TEST_DB_USER,
// HRFLOW_TEST_DB_PASS e, se não for 3306, HRFLOW_TEST_DB_PORT. O teste cria e apaga um banco próprio
// (hrflow_test_<pid>), sem tocar em DB_NAME. Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import type { Connection, Pool, RowDataPacket } from 'mysql2/promise';
import { LIMITES_AUTH_FOLGADOS, pararServidor, subirServidor } from './support/servidor.ts';
import { novoCnpj } from './support/cnpj.ts';

const host = process.env.HRFLOW_TEST_DB_HOST;
const port = process.env.HRFLOW_TEST_DB_PORT ? Number(process.env.HRFLOW_TEST_DB_PORT) : undefined;
const skip = host ? false : 'HRFLOW_TEST_DB_HOST não definido: sem MySQL, nada foi exercitado.';

const SCHEMA = [
    'CREATE TABLE empresas (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL, cnpj CHAR(14) NULL, CONSTRAINT uq_empresas_cnpj UNIQUE (cnpj))',
    `CREATE TABLE usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100), email VARCHAR(100) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL, perfil VARCHAR(50) NOT NULL, empresa_id INT NOT NULL,
        funcionario_id INT NULL, sessao_versao INT NOT NULL DEFAULT 0, senha_provisoria BOOLEAN NOT NULL DEFAULT FALSE)`,
];


describe('autenticação e cadastro contra abuso', { skip }, () => {
    const dbName = `hrflow_test_${process.pid}`;
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const senhaFicticia = 'senha-ficticia-1';
    let admin: Connection | undefined;
    let pool: Pool;
    let criarApp: typeof import('../app.ts').criarApp;
    const servidores: http.Server[] = [];

    const subir = async (limites = {}, trustProxy: boolean | number = false) => {
        const app = criarApp({ limitesAuth: { ...LIMITES_AUTH_FOLGADOS, ...limites }, trustProxy: String(trustProxy) });
        const { server, baseUrl } = await subirServidor(app);
        servidores.push(server);
        return (caminho: string, corpo: unknown, cabecalhos: Record<string, string> = {}) => fetch(`${baseUrl}/api/auth${caminho}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...cabecalhos },
            body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
        }).then(async (resposta) => ({
            status: resposta.status,
            retryAfter: resposta.headers.get('retry-after'),
            cookies: resposta.headers.getSetCookie(),
            corpo: await resposta.json(),
        }));
    };

    const contar = async (tabela: string): Promise<number> =>
        (await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${tabela}`))[0][0].total;

    let sequencia = 0;
    const registro = (extra: Record<string, unknown> = {}) => {
        sequencia += 1;
        return {
            nomeEmpresa: `Empresa Ficticia ${sequencia}`, cnpj: novoCnpj(), nomeAdmin: `Pessoa Ficticia ${sequencia}`,
            email: `pessoa.${sequencia}@exemplo.invalid`, senha: senhaFicticia, confirmacaoSenha: senhaFicticia, ...extra,
        };
    };

    before(async () => {
        admin = await mysql.createConnection({
            host,
            port,
            user: process.env.HRFLOW_TEST_DB_USER,
            password: process.env.HRFLOW_TEST_DB_PASS,
        });
        await admin.query(`CREATE DATABASE \`${dbName}\``);
        await admin.query(`USE \`${dbName}\``);
        for (const sql of SCHEMA) await admin.query(sql);

        process.env.DB_HOST = host;
        if (port) process.env.DB_PORT = String(port);
        process.env.DB_USER = process.env.HRFLOW_TEST_DB_USER;
        process.env.DB_PASS = process.env.HRFLOW_TEST_DB_PASS;
        process.env.DB_NAME = dbName;
        process.env.JWT_SECRET = jwtSecret;
        // Só depois das variáveis de ambiente acima: o pool e o segredo JWT as leem ao carregar.
        pool = (await import('../shared/db/pool.ts')).default;
        ({ criarApp } = await import('../app.ts'));
    });

    after(async () => {
        await Promise.all(servidores.map(pararServidor));
        if (pool) await pool.end();
        if (admin) {
            await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
            await admin.end();
        }
    });

    describe('tamanho do corpo', () => {
        it('recusa com 413 um corpo acima do limite, mesmo com o parser global em 10mb', async () => {
            const chamar = await subir();
            const grande = JSON.stringify({ email: 'a@exemplo.invalid', senha: 'x', lixo: 'a'.repeat(20_000) });
            for (const caminho of ['/login', '/registrar']) {
                const { status, corpo } = await chamar(caminho, grande);
                assert.equal(status, 413, caminho);
                assert.match(corpo.erro, /limite/);
            }
        });

        it('responde 400 em JSON para um corpo malformado', async () => {
            const chamar = await subir();
            const { status, corpo } = await chamar('/login', '{"email": ');
            assert.equal(status, 400);
            assert.match(corpo.erro, /JSON/);
        });
    });

    describe('validação antes do banco', () => {
        it('recusa entrada inválida com 400 e sem criar empresa nem usuário', async () => {
            const chamar = await subir();
            const [empresas, usuarios] = [await contar('empresas'), await contar('usuarios')];
            const invalidas = [
                { nomeEmpresa: { $ne: '' } },
                { nomeAdmin: 12345 },
                { email: 'sem-arroba' },
                { senha: 'curta' },
                { senha: 'a'.repeat(73) },
                { nomeEmpresa: 'a'.repeat(101) },
                { nomeEmpresa: undefined },
                { cnpj: undefined },
                { cnpj: '11.111.111/1111-11' },
                { confirmacaoSenha: undefined },
                { confirmacaoSenha: 'outra-senha-ficticia' },
            ];
            for (const extra of invalidas) {
                const { status, corpo } = await chamar('/registrar', registro(extra));
                assert.equal(status, 400, JSON.stringify(extra));
                assert.equal(typeof corpo.erro, 'string');
            }
            assert.equal(await contar('empresas'), empresas);
            assert.equal(await contar('usuarios'), usuarios);
        });

        it('recusa login com tipos inválidos com 400, sem consultar o banco', async () => {
            const chamar = await subir();
            const original = pool.query;
            let consultas = 0;
            pool.query = ((...args: unknown[]) => {
                consultas += 1;
                return (original as (...args: unknown[]) => unknown).apply(pool, args);
            }) as typeof pool.query;
            try {
                for (const corpo of [{ email: { $ne: '' }, senha: 'x' }, { email: 'a@b.c', senha: 1 }, {}, []]) {
                    assert.equal((await chamar('/login', corpo)).status, 400, JSON.stringify(corpo));
                }
            } finally {
                pool.query = original;
            }
            assert.equal(consultas, 0);
        });
    });

    describe('cadastro transacional', () => {
        it('cria empresa e administrador, normaliza o e-mail e permite o login', async () => {
            const chamar = await subir();
            const dados = registro({ email: 'Pessoa.Maiuscula@Exemplo.invalid' });
            const { status } = await chamar('/registrar', dados);
            assert.equal(status, 201);

            const [[usuario]] = await pool.query<RowDataPacket[]>('SELECT * FROM usuarios WHERE email = ?', ['pessoa.maiuscula@exemplo.invalid']);
            assert.equal(usuario.perfil, 'Administrador');
            assert.notEqual(usuario.senha, senhaFicticia);

            const login = await chamar('/login', { email: 'pessoa.maiuscula@exemplo.invalid', senha: senhaFicticia });
            assert.equal(login.status, 200);
            assert.ok(login.cookies.some((c) => c.startsWith('hrflow_sessao=') && /;\s*HttpOnly/i.test(c)));
        });

        it('não deixa empresa órfã quando a criação do usuário falha', async () => {
            const chamar = await subir();
            const [empresas, usuarios] = [await contar('empresas'), await contar('usuarios')];

            const original = pool.getConnection;
            pool.getConnection = async () => {
                const connection = await original.call(pool);
                const query = connection.query.bind(connection) as (...args: unknown[]) => unknown;
                connection.query = ((sql: string, ...resto: unknown[]) => {
                    if (/INSERT INTO usuarios/.test(sql)) return Promise.reject(new Error('falha injetada'));
                    return query(sql, ...resto);
                }) as typeof connection.query;
                return connection;
            };
            let resposta: Awaited<ReturnType<Awaited<ReturnType<typeof subir>>>>;
            const erro = console.error;
            console.error = () => {};
            try {
                resposta = await chamar('/registrar', registro());
            } finally {
                console.error = erro;
                pool.getConnection = original;
            }

            assert.equal(resposta.status, 500);
            assert.equal(await contar('empresas'), empresas);
            assert.equal(await contar('usuarios'), usuarios);
        });

        it('cadastros simultâneos com o mesmo e-mail criam uma só conta, sem empresa órfã', async () => {
            const chamar = await subir();
            const [empresas, usuarios] = [await contar('empresas'), await contar('usuarios')];
            const email = 'corrida@exemplo.invalid';
            const respostas = await Promise.all(
                Array.from({ length: 4 }, () => chamar('/registrar', registro({ email })))
            );

            assert.equal(respostas.filter((r) => r.status === 201).length, 1);
            assert.ok(respostas.every((r) => r.status === 201 || r.status === 409), JSON.stringify(respostas.map((r) => r.status)));
            assert.equal(await contar('usuarios'), usuarios + 1);
            assert.equal(await contar('empresas'), empresas + 1);
        });

        it('responde 409 para e-mail já cadastrado, sem criar empresa', async () => {
            const chamar = await subir();
            const dados = registro();
            assert.equal((await chamar('/registrar', dados)).status, 201);
            const empresas = await contar('empresas');
            const { status, corpo } = await chamar('/registrar', { ...dados, nomeEmpresa: 'Outra Empresa Ficticia' });
            assert.equal(status, 409);
            assert.match(corpo.erro, /já cadastrado/);
            assert.equal(await contar('empresas'), empresas);
        });
    });

    describe('dados da empresa no cadastro', () => {
        it('recusa CNPJ inválido e confirmação diferente com a mensagem do campo', async () => {
            const chamar = await subir();
            const semCnpj = await chamar('/registrar', registro({ cnpj: undefined }));
            assert.equal(semCnpj.status, 400);
            assert.equal(semCnpj.corpo.erro, 'CNPJ é obrigatório.');
            const invalido = await chamar('/registrar', registro({ cnpj: '11.111.111/1111-11' }));
            assert.equal(invalido.status, 400);
            assert.match(invalido.corpo.erro, /CNPJ inválido/);
            const diferente = await chamar('/registrar', registro({ confirmacaoSenha: 'outra-senha-ficticia' }));
            assert.equal(diferente.status, 400);
            assert.equal(diferente.corpo.erro, 'A confirmação da senha não confere.');
            const ausente = await chamar('/registrar', registro({ confirmacaoSenha: undefined }));
            assert.equal(ausente.corpo.erro, 'Confirme a senha.');
        });

        it('grava o CNPJ só com dígitos e responde 409 para o CNPJ de outra empresa, sem criar conta', async () => {
            const chamar = await subir();
            const cnpj = novoCnpj();
            const pontuado = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
            assert.equal((await chamar('/registrar', registro({ cnpj: pontuado }))).status, 201);
            const [[empresa]] = await pool.query<RowDataPacket[]>('SELECT cnpj FROM empresas WHERE cnpj = ?', [cnpj]);
            assert.equal(empresa.cnpj, cnpj);

            const [empresas, usuarios] = [await contar('empresas'), await contar('usuarios')];
            const repetido = await chamar('/registrar', registro({ cnpj }));
            assert.equal(repetido.status, 409);
            assert.equal(repetido.corpo.erro, 'Este CNPJ já está cadastrado em outra empresa.');
            assert.equal(await contar('empresas'), empresas);
            assert.equal(await contar('usuarios'), usuarios);
        });
    });

    describe('login de contas legadas', () => {
        it('aceita e-mail fora do formato do cadastro e senha curta', async () => {
            const chamar = await subir();
            const hash = await bcrypt.hash('abc', 4);
            await pool.query(
                'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Legado Ficticio', 'legado@localhost', hash, 'Colaborador', 1]
            );
            const { status } = await chamar('/login', { email: 'legado@localhost', senha: 'abc' });
            assert.equal(status, 200);
        });

        it('recusa o hash armazenado quando submetido como senha', async () => {
            const chamar = await subir();
            const senhaHash = await bcrypt.hash('abc', 4);
            await pool.query(
                'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Hash Sintetico', 'hash@localhost', senhaHash, 'Colaborador', 1]
            );
            const [[usuario]] = await pool.query<RowDataPacket[]>('SELECT senha FROM usuarios WHERE email = ?', ['hash@localhost']);
            const resposta = await chamar('/login', { email: 'hash@localhost', senha: usuario.senha });
            assert.equal(resposta.status, 401);
        });
    });

    describe('limitador de tentativas', () => {
        const falhar = (chamar: Awaited<ReturnType<typeof subir>>, email: string, cabecalhos?: Record<string, string>) => chamar('/login', { email, senha: 'senha-errada-1' }, cabecalhos);

        it('bloqueia o login por identidade depois de falhas repetidas, mesmo com a senha certa', async () => {
            const chamar = await subir({ loginPorIdentidade: { windowMs: 60_000, limit: 3 } });
            const dados = registro();
            await chamar('/registrar', dados);

            for (let i = 0; i < 3; i += 1) assert.equal((await falhar(chamar, dados.email)).status, 401);
            const bloqueada = await chamar('/login', { email: dados.email, senha: senhaFicticia });
            assert.equal(bloqueada.status, 429);
            assert.ok(Number(bloqueada.retryAfter) > 0);
            assert.match(bloqueada.corpo.erro, /Muitas tentativas/);

            // Outra identidade, do mesmo IP, não é afetada.
            const outra = registro();
            await chamar('/registrar', outra);
            assert.equal((await chamar('/login', { email: outra.email, senha: senhaFicticia })).status, 200);
        });

        it('trata maiúsculas e espaços do e-mail como a mesma identidade', async () => {
            const chamar = await subir({ loginPorIdentidade: { windowMs: 60_000, limit: 2 } });
            await falhar(chamar, 'alvo@exemplo.invalid');
            await falhar(chamar, ' ALVO@Exemplo.invalid ');
            assert.equal((await falhar(chamar, 'alvo@exemplo.invalid')).status, 429);
        });

        it('não conta logins bem sucedidos contra a identidade', async () => {
            const chamar = await subir({ loginPorIdentidade: { windowMs: 60_000, limit: 2 } });
            const dados = registro();
            await chamar('/registrar', dados);
            for (let i = 0; i < 6; i += 1) {
                assert.equal((await chamar('/login', { email: dados.email, senha: senhaFicticia })).status, 200);
            }
        });

        it('bloqueia o login por IP ao variar as identidades', async () => {
            const chamar = await subir({ loginPorIp: { windowMs: 60_000, limit: 3 } });
            for (let i = 0; i < 3; i += 1) assert.equal((await falhar(chamar, `v${i}@exemplo.invalid`)).status, 401);
            assert.equal((await falhar(chamar, 'v9@exemplo.invalid')).status, 429);
        });

        it('não conta logins corretos contra o IP: um escritório inteiro entra no início do expediente', async () => {
            const chamar = await subir({ loginPorIp: { windowMs: 60_000, limit: 5 } });
            const dados = registro();
            await chamar('/registrar', dados);
            for (let i = 0; i < 31; i += 1) {
                assert.equal((await chamar('/login', { email: dados.email, senha: senhaFicticia })).status, 200, `login ${i + 1}`);
            }
            // As falhas seguem contando, então o IP não vira rota livre para tentar senhas.
            for (let i = 0; i < 5; i += 1) assert.equal((await falhar(chamar, dados.email)).status, 401);
            assert.equal((await falhar(chamar, dados.email)).status, 429);
        });

        it('limita o cadastro por IP, sem tocar o banco depois do limite', async () => {
            const chamar = await subir({ registroPorIp: { windowMs: 60_000, limit: 2 } });
            const empresas = await contar('empresas');
            assert.equal((await chamar('/registrar', registro())).status, 201);
            assert.equal((await chamar('/registrar', registro())).status, 201);
            assert.equal((await chamar('/registrar', registro())).status, 429);
            assert.equal(await contar('empresas'), empresas + 2);
        });

        it('limita o cadastro por identidade', async () => {
            const chamar = await subir({ registroPorIdentidade: { windowMs: 60_000, limit: 2 } });
            const dados = registro();
            assert.equal((await chamar('/registrar', dados)).status, 201);
            assert.equal((await chamar('/registrar', dados)).status, 409);
            assert.equal((await chamar('/registrar', dados)).status, 429);
        });

        it('não deixa X-Forwarded-For forjado escapar do limite quando nenhum proxy é confiável', async () => {
            const chamar = await subir({ loginPorIp: { windowMs: 60_000, limit: 2 } });
            for (let i = 0; i < 2; i += 1) {
                assert.equal((await falhar(chamar, `f${i}@exemplo.invalid`, { 'X-Forwarded-For': `203.0.113.${i}` })).status, 401);
            }
            const { status } = await falhar(chamar, 'f9@exemplo.invalid', { 'X-Forwarded-For': '198.51.100.7' });
            assert.equal(status, 429);
        });

        it('com um proxy confiável, separa clientes pelo IP encaminhado', async () => {
            const chamar = await subir({ loginPorIp: { windowMs: 60_000, limit: 1 } }, 1);
            assert.equal((await falhar(chamar, 'p1@exemplo.invalid', { 'X-Forwarded-For': '203.0.113.1' })).status, 401);
            assert.equal((await falhar(chamar, 'p2@exemplo.invalid', { 'X-Forwarded-For': '203.0.113.2' })).status, 401);
            assert.equal((await falhar(chamar, 'p3@exemplo.invalid', { 'X-Forwarded-For': '203.0.113.1' })).status, 429);
        });
    });
});
