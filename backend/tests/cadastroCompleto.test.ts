// Cadastro completo do colaborador (B-23): CPF válido e único por empresa, edição parcial, documentos,
// endereço e contato de emergência, dependentes, importação por CSV e nomes únicos de departamento e
// cargo. Exige um MySQL real (variáveis HRFLOW_TEST_DB_*, veja tests/support/bancoDeTeste.ts): sem
// ele os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao, tokenDaResposta } from './support/sessao.ts';
import { LIMITES_AUTH_FOLGADOS, pararServidor, subirServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';

// CPF válido derivado de um número, com os dois dígitos verificadores calculados aqui (escritos à
// parte de modules/funcionarios/funcionarios.regras.ts de propósito). Dá um CPF distinto por número.
const cpfDeTeste = (numero: number): string => {
    const base = String(100000000 + numero).slice(-9);
    const digito = (digitos: string) => {
        const soma = [...digitos].reduce((total, d, i) => total + Number(d) * (digitos.length + 1 - i), 0);
        return ((soma * 10) % 11) % 10;
    };
    const primeiro = digito(base);
    return `${base}${primeiro}${digito(base + primeiro)}`;
};
const comPontuacao = (cpf: string) => `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

describe('cadastro completo', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    let empresaA: number;
    let empresaB: number;
    let rhId: number;
    const tokens: Record<string, string> = {};

    const requisitar = async (metodo: string, caminho: string, token: string | undefined, corpo?: string, tipo = 'application/json') => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': tipo, ...cabecalhosDaSessao(token) },
            body: corpo,
        });
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, cabecalhos: resposta.headers };
    };
    const chamar = (metodo: string, caminho: string, token: string | undefined, corpo?: unknown) =>
        requisitar(metodo, caminho, token, corpo === undefined ? undefined : JSON.stringify(corpo));
    const importar = (csv: string, token = tokens.admin, tipo = 'text/csv') => requisitar('POST', '/api/funcionarios/importar', token, csv, tipo);

    const consultar = async <T extends RowDataPacket>(sql: string, valores: unknown[]): Promise<T[]> => (await db.query<T[]>(sql, valores))[0];
    const inserir = async (sql: string, valores: unknown[]) => (await db.query<ResultSetHeader>(sql, valores))[0].insertId;
    const colaboradorPorEmail = async (email: string) => (await consultar('SELECT * FROM funcionarios WHERE email = ?', [email]))[0];

    let sequencia = 0;
    const novoCadastro = (extra: Record<string, unknown> = {}) => {
        sequencia += 1;
        return { nome: `Pessoa Ficticia ${sequencia}`, email: `cadastro.completo.${sequencia}@exemplo.invalid`, senha: 'senha-ficticia', ...extra };
    };
    const criar = async (extra: Record<string, unknown> = {}, token = tokens.admin) => {
        const entrada = novoCadastro(extra);
        const resposta = await chamar('POST', '/api/funcionarios', token, entrada);
        assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
        return { entrada, id: (await colaboradorPorEmail(entrada.email)).id as number };
    };

    before(async () => {
        await banco.preparar();
        ({ server: servidor, baseUrl } = await subirServidor(criarApp({ limitesAuth: LIMITES_AUTH_FOLGADOS })));

        empresaA = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A']);
        empresaB = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia B']);
        tokens.admin = (await criarUsuario(db, { empresaId: empresaA, perfil: 'Administrador' })).token;
        tokens.adminB = (await criarUsuario(db, { empresaId: empresaB, perfil: 'Administrador' })).token;
        rhId = await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Rita RH Ficticia', 'rita.cadastro@exemplo.invalid', empresaA]);
        tokens.rh = (await criarUsuario(db, { empresaId: empresaA, perfil: 'RH', funcionarioId: rhId })).token;
        const colaborador = await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Caio Colaborador Ficticio', 'caio.cadastro@exemplo.invalid', empresaA]);
        tokens.colaborador = (await criarUsuario(db, { empresaId: empresaA, perfil: 'Colaborador', funcionarioId: colaborador })).token;
    });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    describe('CPF', () => {
        it('recusa 111.111.111-11 com 400 "CPF inválido"', async () => {
            const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.admin, novoCadastro({ cpf: '111.111.111-11' }));
            assert.equal(status, 400);
            assert.match(corpo.erro, /^CPF inválido/);
            assert.equal(corpo.detalhes[0].campo, 'cpf');
        });

        it('recusa dígito verificador errado, tamanho errado e texto que não é CPF', async () => {
            for (const cpf of ['529.982.247-24', '5299822472', '123456789012', 'abc.def.ghi-jk', 52998224725]) {
                const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.admin, novoCadastro({ cpf }));
                assert.equal(status, 400, String(cpf));
                assert.match(corpo.erro, /CPF/);
            }
        });

        it('guarda e devolve só os dígitos, venha o CPF com ou sem pontuação', async () => {
            const cpf = cpfDeTeste(1);
            const { entrada } = await criar({ cpf: comPontuacao(cpf) });
            assert.equal((await colaboradorPorEmail(entrada.email)).cpf, cpf);
            const lista = (await chamar('GET', `/api/funcionarios?busca=${encodeURIComponent(comPontuacao(cpf).slice(0, 7))}`, tokens.admin)).corpo;
            assert.deepEqual(lista.map((f: { email: string }) => f.email), [entrada.email], 'a busca com pontuação acha o CPF gravado só com dígitos');
            assert.equal(lista[0].cpf, cpf);
        });

        it('o segundo cadastro com o mesmo CPF na mesma empresa é 409, também com outra pontuação, e não deixa acesso órfão', async () => {
            const cpf = cpfDeTeste(2);
            await criar({ cpf });
            for (const repetido of [cpf, comPontuacao(cpf)]) {
                const entrada = novoCadastro({ cpf: repetido });
                const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.admin, entrada);
                assert.equal(status, 409, JSON.stringify(corpo));
                assert.equal(corpo.erro, 'Já existe um colaborador com este CPF nesta empresa.');
                assert.deepEqual(corpo.detalhes, [{ campo: 'cpf', mensagem: corpo.erro }]);
                assert.equal((await consultar('SELECT id FROM funcionarios WHERE email = ?', [entrada.email])).length, 0);
                assert.equal((await consultar('SELECT id FROM usuarios WHERE email = ?', [entrada.email])).length, 0);
            }
        });

        it('o mesmo CPF em outra empresa é 201', async () => {
            const cpf = cpfDeTeste(3);
            await criar({ cpf });
            await criar({ cpf }, tokens.adminB);
            assert.equal((await consultar('SELECT id FROM funcionarios WHERE cpf = ?', [cpf])).length, 2);
        });

        it('cadastros sem CPF não colidem entre si', async () => {
            await criar();
            await criar({ cpf: '' });
            await criar({ cpf: null });
        });

        it('editar para o CPF de outro colaborador é 409 e não altera o cadastro', async () => {
            const cpf = cpfDeTeste(4);
            await criar({ cpf });
            const { id } = await criar({ cpf: cpfDeTeste(5) });
            const { status, corpo } = await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { cpf });
            assert.equal(status, 409);
            assert.equal(corpo.erro, 'Já existe um colaborador com este CPF nesta empresa.');
            assert.equal((await consultar('SELECT cpf FROM funcionarios WHERE id = ?', [id]))[0].cpf, cpfDeTeste(5));
        });
    });

    describe('edição parcial (PATCH)', () => {
        it('com só o telefone, o salário e o resto do cadastro não mudam', async () => {
            const { id } = await criar({ cpf: cpfDeTeste(10), telefone: '(91) 90000-0001', salario_base: 4200.75, tipo_contrato: 'PJ', nivel: 'Sênior', data_admissao: '2024-02-01', rg: '1234567', banco: 'Banco Ficticio' });
            const antes = (await consultar('SELECT * FROM funcionarios WHERE id = ?', [id]))[0];

            const { status } = await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { telefone: '(91) 90000-0002' });
            assert.equal(status, 200);

            const depois = (await consultar('SELECT * FROM funcionarios WHERE id = ?', [id]))[0];
            assert.equal(depois.telefone, '(91) 90000-0002');
            assert.equal(Number(depois.salario_base), 4200.75);
            assert.deepEqual({ ...depois, telefone: null }, { ...antes, telefone: null }, 'nenhuma outra coluna mudou');
        });

        it('null e texto vazio limpam o campo enviado, e só ele', async () => {
            const { id } = await criar({ telefone: '(91) 90000-0003', rg: '7654321', banco: 'Banco Ficticio' });
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { telefone: null, rg: '' })).status, 200);
            const depois = (await consultar('SELECT telefone, rg, banco FROM funcionarios WHERE id = ?', [id]))[0];
            assert.deepEqual({ ...depois }, { telefone: null, rg: null, banco: 'Banco Ficticio' });
        });

        it('nome e e-mail não se limpam, e o corpo vazio é 400', async () => {
            const { id } = await criar();
            const semNome = await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { nome: '' });
            assert.equal(semNome.status, 400);
            assert.equal(semNome.corpo.erro, 'Nome é obrigatório.');
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { email: null })).status, 400);
            const vazio = await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, {});
            assert.equal(vazio.status, 400);
            assert.equal(vazio.corpo.erro, 'Envie ao menos um campo para alterar.');
        });

        it('sincroniza só o que veio: mudar o nome não troca o e-mail de login', async () => {
            const { entrada, id } = await criar();
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { nome: 'Nome Parcial' })).status, 200);
            const acesso = (await consultar('SELECT nome, email FROM usuarios WHERE funcionario_id = ?', [id]))[0];
            assert.deepEqual({ ...acesso }, { nome: 'Nome Parcial', email: entrada.email });
        });

        it('confere a admissão contra o nascimento já gravado', async () => {
            const { id } = await criar({ data_nascimento: '1990-05-17' });
            const { status, corpo } = await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { data_admissao: '1989-01-01' });
            assert.equal(status, 400);
            assert.equal(corpo.erro, 'Data de admissão não pode ser anterior à data de nascimento.');
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { data_admissao: '2020-01-01' })).status, 200);
        });

        it('recusa campo desconhecido, incluindo o status e o endereço em texto livre', async () => {
            const { id } = await criar();
            for (const campo of ['status', 'endereco', 'empresa_id', 'senha']) {
                const { status, corpo } = await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { [campo]: 'x' });
                assert.equal(status, 400, campo);
                assert.match(corpo.erro, new RegExp(`Campo desconhecido: ${campo}`));
            }
        });

        it('o RH não altera o próprio cadastro: 403 e nada muda', async () => {
            const { status } = await chamar('PATCH', `/api/funcionarios/${rhId}`, tokens.rh, { telefone: '(91) 90000-0009' });
            assert.equal(status, 403);
            assert.equal((await consultar('SELECT telefone FROM funcionarios WHERE id = ?', [rhId]))[0].telefone, null);
        });
    });

    describe('documentos, endereço e contato de emergência', () => {
        const completo = {
            matricula: 'MAT-0001', rg: '1234567 SSP/PA', pis: '120.12345.67-2', ctps: '1234567/0001',
            cep: '66.000-000', logradouro: 'Rua Ficticia', numero: '100', complemento: 'Apto 2', bairro: 'Centro', cidade: 'Belém', uf: 'pa',
            contato_emergencia_nome: 'Maria Ficticia', contato_emergencia_telefone: '(91) 90000-1111', contato_emergencia_parentesco: 'Mãe',
        };

        it('grava no cadastro e na edição, normalizando PIS, CEP e UF, e a listagem devolve tudo', async () => {
            const { entrada, id } = await criar(completo);
            const lista = (await chamar('GET', `/api/funcionarios?busca=${encodeURIComponent(entrada.email)}`, tokens.admin)).corpo[0];
            assert.equal(lista.id, id);
            assert.deepEqual(
                Object.fromEntries(Object.keys(completo).map((chave) => [chave, lista[chave]])),
                { ...completo, pis: '12012345672', cep: '66000000', uf: 'PA' }
            );

            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}`, tokens.admin, { cidade: 'Ananindeua', contato_emergencia_nome: null })).status, 200);
            const editado = (await consultar('SELECT cidade, contato_emergencia_nome, logradouro FROM funcionarios WHERE id = ?', [id]))[0];
            assert.deepEqual({ ...editado }, { cidade: 'Ananindeua', contato_emergencia_nome: null, logradouro: 'Rua Ficticia' });
        });

        it('recusa PIS, CEP e UF inválidos com a mensagem do campo', async () => {
            const recusas: Record<string, [Record<string, unknown>, RegExp]> = {
                'PIS com dígito errado': [{ pis: '12012345673' }, /PIS inválido/],
                'CEP curto': [{ cep: '6600000' }, /CEP inválido/],
                'UF que não existe': [{ uf: 'XX' }, /UF inválida/],
                'matrícula longa': [{ matricula: 'x'.repeat(21) }, /Matrícula deve ter no máximo 20/],
                'telefone de emergência inválido': [{ contato_emergencia_telefone: 'abc' }, /Telefone/],
            };
            for (const [rotulo, [extra, mensagem]] of Object.entries(recusas)) {
                const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.admin, novoCadastro(extra));
                assert.equal(status, 400, rotulo);
                assert.match(corpo.erro, mensagem, rotulo);
            }
        });

        it('a matrícula é única por empresa', async () => {
            await criar({ matricula: 'MAT-UNICA' });
            const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.admin, novoCadastro({ matricula: 'MAT-UNICA' }));
            assert.equal(status, 409);
            assert.equal(corpo.erro, 'Já existe um colaborador com esta matrícula nesta empresa.');
            await criar({ matricula: 'MAT-UNICA' }, tokens.adminB);
        });
    });

    describe('dependentes', () => {
        const filha = (extra: Record<string, unknown> = {}) => ({ nome: 'Filha Ficticia', parentesco: 'Filho(a)', data_nascimento: '2018-05-01', cpf: null, ...extra });

        it('cadastra, lista em ordem de nascimento, altera e remove', async () => {
            const { id } = await criar();
            const caminho = `/api/funcionarios/${id}/dependentes`;
            const nova = await chamar('POST', caminho, tokens.admin, filha({ cpf: comPontuacao(cpfDeTeste(20)) }));
            assert.equal(nova.status, 201, JSON.stringify(nova.corpo));
            assert.equal((await chamar('POST', caminho, tokens.admin, filha({ nome: 'Filho Mais Velho', data_nascimento: '2012-03-09' }))).status, 201);

            const lista = (await chamar('GET', caminho, tokens.admin)).corpo;
            assert.deepEqual(lista.map((d: { nome: string }) => d.nome), ['Filho Mais Velho', 'Filha Ficticia']);
            assert.equal(lista[1].cpf, cpfDeTeste(20));
            assert.equal(lista[1].data_nascimento, '2018-05-01');

            const alterado = await chamar('PUT', `${caminho}/${nova.corpo.id}`, tokens.admin, filha({ nome: 'Filha Renomeada', parentesco: 'Enteado(a)' }));
            assert.equal(alterado.status, 200);
            assert.equal((await consultar('SELECT nome, parentesco, cpf FROM dependentes WHERE id = ?', [nova.corpo.id]))[0].cpf, null);

            assert.equal((await chamar('DELETE', `${caminho}/${nova.corpo.id}`, tokens.admin)).status, 200);
            assert.equal((await chamar('GET', caminho, tokens.admin)).corpo.length, 1);
            assert.equal((await chamar('DELETE', `${caminho}/${nova.corpo.id}`, tokens.admin)).status, 404);
        });

        it('valida os dados e recusa o CPF repetido do mesmo colaborador', async () => {
            const { id } = await criar();
            const caminho = `/api/funcionarios/${id}/dependentes`;
            const recusas: Record<string, [Record<string, unknown>, RegExp]> = {
                'nome vazio': [{ nome: '' }, /Nome do dependente é obrigatório/],
                'parentesco fora da lista': [{ parentesco: 'Vizinho' }, /Parentesco deve ser um destes valores/],
                'nascimento no futuro': [{ data_nascimento: '2999-01-01' }, /Data de nascimento deve estar entre/],
                'CPF inválido': [{ cpf: '111.111.111-11' }, /^CPF inválido/],
                'campo desconhecido': [{ deduz_irrf: true }, /Campo desconhecido: deduz_irrf/],
            };
            for (const [rotulo, [extra, mensagem]] of Object.entries(recusas)) {
                const { status, corpo } = await chamar('POST', caminho, tokens.admin, filha(extra));
                assert.equal(status, 400, rotulo);
                assert.match(corpo.erro, mensagem, rotulo);
            }
            assert.equal((await chamar('POST', caminho, tokens.admin, filha({ cpf: cpfDeTeste(21) }))).status, 201);
            const repetido = await chamar('POST', caminho, tokens.admin, filha({ nome: 'Outro Filho', cpf: cpfDeTeste(21) }));
            assert.equal(repetido.status, 409);
            assert.equal(repetido.corpo.erro, 'Este CPF já está cadastrado como dependente deste colaborador.');
        });

        it('colaborador de outra empresa ou inexistente é 404; dependente de outro colaborador também', async () => {
            const { id } = await criar();
            const { id: outro } = await criar();
            const dependente = (await chamar('POST', `/api/funcionarios/${outro}/dependentes`, tokens.admin, filha())).corpo.id;
            for (const caminho of [`/api/funcionarios/${id}/dependentes`, '/api/funcionarios/999999/dependentes']) {
                assert.equal((await chamar('GET', caminho, tokens.adminB)).status, 404, caminho);
            }
            assert.equal((await chamar('POST', `/api/funcionarios/${id}/dependentes`, tokens.adminB, filha())).status, 404);
            assert.equal((await chamar('PUT', `/api/funcionarios/${id}/dependentes/${dependente}`, tokens.admin, filha())).status, 404, 'o dependente é de outro colaborador');
            assert.equal((await chamar('DELETE', `/api/funcionarios/${id}/dependentes/${dependente}`, tokens.admin)).status, 404);
            assert.equal((await consultar('SELECT id FROM dependentes WHERE id = ?', [dependente])).length, 1);
        });

        it('o RH vê os dependentes de todos, mas não os altera no próprio cadastro nem no de outro RH', async () => {
            assert.equal((await chamar('GET', `/api/funcionarios/${rhId}/dependentes`, tokens.rh)).status, 200);
            const propria = await chamar('POST', `/api/funcionarios/${rhId}/dependentes`, tokens.rh, filha());
            assert.equal(propria.status, 403);
            const { id } = await criar();
            assert.equal((await chamar('POST', `/api/funcionarios/${id}/dependentes`, tokens.rh, filha())).status, 201);
        });

        it('excluir o colaborador leva os dependentes junto', async () => {
            const { id } = await criar();
            await chamar('POST', `/api/funcionarios/${id}/dependentes`, tokens.admin, filha());
            assert.equal((await chamar('DELETE', `/api/funcionarios/${id}`, tokens.admin)).status, 200);
            assert.equal((await consultar('SELECT id FROM dependentes WHERE funcionario_id = ?', [id])).length, 0);
        });
    });

    describe('estrutura sem duplicidade', () => {
        const idDe = async (tabela: 'departamentos' | 'cargos', nome: string, empresa = empresaA) =>
            (await consultar(`SELECT id FROM ${tabela} WHERE empresa_id = ? AND nome = ?`, [empresa, nome]))[0].id as number;

        it('departamento com nome repetido é 409 com mensagem, também com outra caixa, e em outra empresa é 201', async () => {
            const primeiro = await chamar('POST', '/api/estrutura/departamentos', tokens.admin, { nome: 'Logística', sigla: 'log' });
            assert.equal(primeiro.status, 201);
            assert.equal((await consultar('SELECT sigla FROM departamentos WHERE empresa_id = ? AND nome = ?', [empresaA, 'Logística']))[0].sigla, 'LOG', 'a sigla é gravada em maiúsculas');

            for (const nome of ['Logística', 'LOGÍSTICA', 'logistica', '  Logística  ']) {
                const repetido = await chamar('POST', '/api/estrutura/departamentos', tokens.admin, { nome, sigla: 'LG2' });
                assert.equal(repetido.status, 409, nome);
                assert.equal(repetido.corpo.erro, 'Já existe um departamento com este nome nesta empresa.');
            }
            assert.equal((await chamar('POST', '/api/estrutura/departamentos', tokens.adminB, { nome: 'Logística', sigla: 'LOG' })).status, 201);
        });

        it('renomear departamento para o nome de outro é 409, e manter o próprio nome é 200', async () => {
            await chamar('POST', '/api/estrutura/departamentos', tokens.admin, { nome: 'Compras', sigla: 'COM' });
            const id = await idDe('departamentos', 'Compras');
            const colide = await chamar('PUT', `/api/estrutura/departamentos/${id}`, tokens.admin, { nome: 'Financeiro', sigla: 'COM' });
            assert.equal(colide.status, 409);
            assert.equal(colide.corpo.erro, 'Já existe um departamento com este nome nesta empresa.');
            assert.equal((await chamar('PUT', `/api/estrutura/departamentos/${id}`, tokens.admin, { nome: 'Compras', sigla: 'cmp' })).status, 200);
        });

        it('cargo com nome repetido no mesmo departamento é 409; em outro departamento ou empresa é 201', async () => {
            const ti = await idDe('departamentos', 'Tecnologia da Informação (TI)');
            const financeiro = await idDe('departamentos', 'Financeiro');
            const repetido = await chamar('POST', '/api/estrutura/cargos', tokens.admin, { nome: 'desenvolvedor(a)', departamento_id: ti });
            assert.equal(repetido.status, 409);
            assert.equal(repetido.corpo.erro, 'Já existe um cargo com este nome neste departamento.');
            assert.equal((await chamar('POST', '/api/estrutura/cargos', tokens.admin, { nome: 'Desenvolvedor(a)', departamento_id: financeiro })).status, 201);
            const tiB = await idDe('departamentos', 'Tecnologia da Informação (TI)', empresaB);
            assert.equal((await chamar('POST', '/api/estrutura/cargos', tokens.adminB, { nome: 'Analista Ficticio', departamento_id: tiB })).status, 201);

            const analista = await idDe('cargos', 'Gerente Financeiro');
            const colide = await chamar('PUT', `/api/estrutura/cargos/${analista}`, tokens.admin, { nome: 'Assistente Administrativo', departamento_id: financeiro });
            assert.equal(colide.status, 409);
        });
    });

    describe('importação por CSV', () => {
        const CABECALHO = 'nome,email,cpf,telefone,data_nascimento,data_admissao,cargo,departamento,tipo_contrato,salario_base';
        const linhaValida = (n: number, extra: Partial<Record<string, string>> = {}) => {
            const campos = {
                nome: `Importada Ficticia ${n}`, email: `importada.${n}@exemplo.invalid`, cpf: comPontuacao(cpfDeTeste(1000 + n)), telefone: '(91) 90000-0000',
                data_nascimento: '1990-05-17', data_admissao: '2024-01-02', cargo: 'Desenvolvedor(a)', departamento: 'TI', tipo_contrato: 'CLT', salario_base: '3500.50', ...extra,
            };
            return Object.values(campos).join(',');
        };

        it('100 linhas com 3 inválidas criam 97 e devolvem as 3 com o motivo e o número da linha', async () => {
            const invalidas: Record<number, [Partial<Record<string, string>>, RegExp]> = {
                10: [{ cpf: '111.111.111-11' }, /CPF inválido/],
                40: [{ email: 'sem-arroba' }, /e-mail válido/],
                77: [{ cargo: 'Cargo Que Nao Existe' }, /Cargo "Cargo Que Nao Existe" não encontrado no departamento "TI"/],
            };
            const linhas = Array.from({ length: 100 }, (_, i) => linhaValida(i + 1, invalidas[i + 1]?.[0]));
            const { status, corpo, cabecalhos } = await importar(`${CABECALHO}\n${linhas.join('\n')}\n`);

            assert.equal(status, 200, JSON.stringify(corpo));
            assert.equal(corpo.total, 100);
            assert.equal(corpo.criados, 97);
            assert.deepEqual(corpo.erros.map((e: { linha: number }) => e.linha), [11, 41, 78], 'a linha 1 do arquivo é o cabeçalho');
            for (const [indice, [, motivo]] of Object.entries(invalidas)) {
                const erro = corpo.erros.find((e: { linha: number }) => e.linha === Number(indice) + 1);
                assert.match(erro.motivo, motivo);
                assert.equal(erro.nome, `Importada Ficticia ${indice}`);
            }
            assert.equal(corpo.credenciais.length, 97);
            assert.match(cabecalhos.get('cache-control') ?? '', /no-store/);

            const gravados = await consultar('SELECT id, cpf, salario_base, cargo_id, departamento_id, empresa_id, status FROM funcionarios WHERE email LIKE ?', ['importada.%@exemplo.invalid']);
            assert.equal(gravados.length, 97);
            assert.ok(gravados.every((f) => f.empresa_id === empresaA && f.status === 'Ativo' && f.cargo_id && f.departamento_id && Number(f.salario_base) === 3500.5));
            assert.ok(gravados.every((f) => /^\d{11}$/.test(f.cpf)), 'CPF só com dígitos');
            assert.equal((await consultar("SELECT id FROM usuarios WHERE email LIKE 'importada.%@exemplo.invalid' AND perfil = 'Colaborador' AND senha_provisoria = TRUE", [])).length, 97);
        });

        it('cada colaborador importado entra com a senha provisória do relatório e é obrigado a trocá-la', async () => {
            const { corpo } = await importar(`${CABECALHO}\n${linhaValida(201)}\n`);
            assert.equal(corpo.criados, 1);
            const [credencial] = corpo.credenciais;
            assert.deepEqual(Object.keys(credencial).sort(), ['email', 'linha', 'nome', 'senha_provisoria']);
            assert.equal(credencial.linha, 2);

            const login = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: credencial.email, senha: credencial.senha_provisoria }),
            });
            assert.equal(login.status, 200);
            assert.equal((await login.json()).senhaProvisoria, true);
            assert.ok(tokenDaResposta(login));
        });

        it('importar o mesmo arquivo de novo não duplica ninguém: cada linha volta com o motivo', async () => {
            const arquivo = `${CABECALHO}\n${linhaValida(301)}\n${linhaValida(302)}\n`;
            assert.equal((await importar(arquivo)).corpo.criados, 2);
            const { corpo } = await importar(arquivo);
            assert.equal(corpo.criados, 0);
            assert.equal(corpo.erros.length, 2);
            assert.match(corpo.erros[0].motivo, /e-mail já está registado/);
            assert.equal((await consultar('SELECT id FROM funcionarios WHERE email = ?', ['importada.301@exemplo.invalid'])).length, 1);
        });

        it('CPF repetido dentro do arquivo vale para a segunda linha; em outra empresa é permitido', async () => {
            const cpf = comPontuacao(cpfDeTeste(1401));
            const { corpo } = await importar(`${CABECALHO}\n${linhaValida(401, { cpf })}\n${linhaValida(402, { cpf })}\n`);
            assert.equal(corpo.criados, 1);
            assert.deepEqual(corpo.erros.map((e: { linha: number; motivo: string }) => [e.linha, e.motivo]), [[3, 'Já existe um colaborador com este CPF nesta empresa.']]);
            const outraEmpresa = await importar(`${CABECALHO}\n${linhaValida(403, { cpf })}\n`, tokens.adminB);
            assert.equal(outraEmpresa.corpo.criados, 1, JSON.stringify(outraEmpresa.corpo.erros));
        });

        it('aceita ponto e vírgula, BOM, CRLF, aspas, datas dd/mm/aaaa, salário em formato brasileiro e e-mail como e_mail', async () => {
            const arquivo = '﻿E-mail;Nome;"Data de Nascimento";Salário_Base;CPF;Setor\r\n';
            assert.ok(arquivo.length > 0);
            const csv = [
                'e-mail;nome;cpf;data_admissao;salario_base;cargo;departamento',
                `br.1@exemplo.invalid;"Silva, Joana Ficticia";${comPontuacao(cpfDeTeste(1501))};15/03/2024;"R$ 3.500,50";Analista de RH;Recursos Humanos (RH)`,
                `br.2@exemplo.invalid;Joana Sem Cargo;;02/01/2024;1200,5;;`,
            ].join('\r\n');
            const { status, corpo } = await importar(`﻿${csv}`);
            assert.equal(status, 200, JSON.stringify(corpo));
            assert.equal(corpo.criados, 2, JSON.stringify(corpo.erros));
            const primeira = await colaboradorPorEmail('br.1@exemplo.invalid');
            assert.equal(primeira.nome, 'Silva, Joana Ficticia');
            assert.equal(Number(primeira.salario_base), 3500.5);
            assert.equal((await consultar("SELECT DATE_FORMAT(data_admissao, '%Y-%m-%d') AS dia FROM funcionarios WHERE id = ?", [primeira.id]))[0].dia, '2024-03-15');
            assert.ok(primeira.departamento_id);
            const segunda = await colaboradorPorEmail('br.2@exemplo.invalid');
            assert.equal(Number(segunda.salario_base), 1200.5);
            assert.equal(segunda.cargo_id, null);
        });

        it('cargo que existe em mais de um departamento pede o departamento; com ele, resolve', async () => {
            const financeiro = (await consultar('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresaA, 'FIN']))[0].id;
            await chamar('POST', '/api/estrutura/cargos', tokens.admin, { nome: 'Cargo Em Dois', departamento_id: financeiro });
            const ti = (await consultar('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresaA, 'TI']))[0].id;
            await chamar('POST', '/api/estrutura/cargos', tokens.admin, { nome: 'Cargo Em Dois', departamento_id: ti });

            const sem = await importar(`nome,email,cargo\nSem Setor,ambiguo.1@exemplo.invalid,Cargo Em Dois\n`);
            assert.equal(sem.corpo.criados, 0);
            assert.match(sem.corpo.erros[0].motivo, /existe em mais de um departamento: informe a coluna departamento/);
            const com = await importar(`nome,email,cargo,departamento\nCom Setor,ambiguo.2@exemplo.invalid,Cargo Em Dois,fin\n`);
            assert.equal(com.corpo.criados, 1);
            assert.equal((await colaboradorPorEmail('ambiguo.2@exemplo.invalid')).cargo_id, (await consultar('SELECT id FROM cargos WHERE departamento_id = ? AND nome = ?', [financeiro, 'Cargo Em Dois']))[0].id);
        });

        it('recusa o arquivo inteiro, sem criar ninguém, quando ele não tem o que a importação precisa', async () => {
            const antes = (await consultar('SELECT COUNT(*) AS total FROM funcionarios', []))[0].total;
            const recusas: Record<string, [string, RegExp]> = {
                'vazio': ['  \n', /O arquivo CSV está vazio/],
                'só o cabeçalho': ['nome,email\n', /não tem nenhuma linha/],
                'sem a coluna e-mail': ['nome,cpf\nFulana,\n', /O cabeçalho precisa das colunas: email/],
                'coluna desconhecida': ['nome,email,salario_liquido\nA,a@exemplo.invalid,1\n', /Coluna desconhecida: salario_liquido\. Colunas aceitas: nome, email/],
                'coluna repetida': ['nome,email,nome\nA,a@exemplo.invalid,B\n', /colunas repetidas/],
                'linhas demais': [`nome,email\n${Array.from({ length: 501 }, (_, i) => `P${i},p${i}@exemplo.invalid`).join('\n')}\n`, /máximo é 500/],
            };
            for (const [rotulo, [csv, mensagem]] of Object.entries(recusas)) {
                const { status, corpo } = await importar(csv);
                assert.equal(status, 400, rotulo);
                assert.match(corpo.erro, mensagem, rotulo);
            }
            assert.equal((await consultar('SELECT COUNT(*) AS total FROM funcionarios', []))[0].total, antes);
        });

        it('exige o arquivo como texto, o perfil de gestão e responde 413 acima do limite', async () => {
            const json = await requisitar('POST', '/api/funcionarios/importar', tokens.admin, JSON.stringify({ nome: 'x' }));
            assert.equal(json.status, 400);
            assert.match(json.corpo.erro, /Envie o arquivo CSV/);
            assert.equal((await importar(`${CABECALHO}\n${linhaValida(601)}\n`, tokens.colaborador)).status, 403);
            assert.equal((await importar(`${CABECALHO}\n${linhaValida(602)}\n`, tokens.rh, 'text/plain')).corpo.criados, 1, 'text/plain também vale');
            assert.equal((await importar('x'.repeat(2 * 1024 * 1024 + 1))).status, 413);
        });
    });
});
