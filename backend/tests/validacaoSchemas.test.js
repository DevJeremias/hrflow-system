// SEC-07: schemas de entrada de funcionários, estrutura, perfil e paginação, mais a tradução de
// erros do MySQL. Funções puras: não precisam de banco.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { criarFuncionario, atualizarFuncionario } = require('../schemas/funcionarioSchemas');
const estrutura = require('../schemas/estruturaSchemas');
const { atualizarMeusDados, alterarSenha } = require('../schemas/perfilSchemas');
const { paginacao } = require('../schemas/paginacao');
const { validarAvatar, TAMANHO_MAXIMO_BYTES } = require('../utils/validacaoAvatar');
const { traduzirErro } = require('../utils/erros');
const { dataUrl } = require('./support/imagens');

const mensagens = (resultado) => resultado.error.issues.map((issue) => issue.message);

const recusa = (schema, entrada, esperado) => {
    const resultado = schema.safeParse(entrada);
    assert.equal(resultado.success, false, `deveria recusar ${JSON.stringify(entrada)?.slice(0, 120)}`);
    assert.match(mensagens(resultado)[0], esperado);
};

const funcionarioValido = () => ({ nome: 'Pessoa Ficticia', email: 'Pessoa@Exemplo.invalid', senha: 'senha-ficticia' });
// A edição não aceita senha (quem troca é o próprio usuário no perfil).
const edicaoValida = () => ({ nome: 'Pessoa Ficticia', email: 'Pessoa@Exemplo.invalid' });

describe('schema de cadastro de funcionário', () => {
    it('normaliza uma entrada completa', () => {
        const { success, data } = criarFuncionario.safeParse({
            ...funcionarioValido(), nome: '  Pessoa Ficticia  ', cpf: '000.000.000-01', telefone: '(00) 90000-0000',
            data_nascimento: '1990-05-17', data_admissao: '2024-02-29', endereco: 'Rua Ficticia, 1', banco: 'Banco Ficticio',
            agencia: '0001', conta: '12345-6', tipo_conta: 'Corrente', cargo_id: '7', departamento_id: 3,
            nivel: ' Pleno ', tipo_contrato: 'CLT', salario_base: '3500.50', status: 'Qualquer',
        });
        assert.equal(success, true);
        assert.equal(data.nome, 'Pessoa Ficticia');
        assert.equal(data.email, 'pessoa@exemplo.invalid');
        assert.equal(data.cargo_id, 7);
        assert.equal(data.salario_base, 3500.5);
        assert.equal(data.status, undefined, 'o status do cadastro novo não vem do cliente');
        assert.equal(data.nivel, 'Pleno');
    });

    it('trata campos em branco como ausentes, como os formulários enviam', () => {
        const { success, data } = criarFuncionario.safeParse({
            ...funcionarioValido(), cpf: '', telefone: ' ', data_admissao: '', cargo_id: null, salario_base: '', tipo_contrato: '',
        });
        assert.equal(success, true);
        for (const chave of ['cpf', 'telefone', 'data_admissao', 'cargo_id', 'departamento_id', 'salario_base', 'tipo_contrato', 'banco']) {
            assert.equal(data[chave], null, chave);
        }
    });

    it('aceita salário zero e o maior valor da coluna', () => {
        assert.equal(criarFuncionario.safeParse({ ...funcionarioValido(), salario_base: 0 }).data.salario_base, 0);
        assert.equal(criarFuncionario.safeParse({ ...funcionarioValido(), salario_base: '99999999.99' }).data.salario_base, 99999999.99);
    });

    const recusas = {
        'corpo ausente': [undefined, /JSON/],
        'corpo em array': [[funcionarioValido()], /JSON/],
        'nome ausente': [{ ...funcionarioValido(), nome: undefined }, /Nome é obrigatório/],
        'nome objeto': [{ ...funcionarioValido(), nome: { $ne: '' } }, /Nome deve ser um texto/],
        'nome com 101 caracteres': [{ ...funcionarioValido(), nome: 'a'.repeat(101) }, /Nome deve ter no máximo 100/],
        'e-mail inválido': [{ ...funcionarioValido(), email: 'sem-arroba' }, /e-mail válido/],
        'senha curta': [{ ...funcionarioValido(), senha: '1234567' }, /mínimo 8/],
        'senha ausente': [{ ...funcionarioValido(), senha: undefined }, /Senha é obrigatória/],
        'senha acima de 72 bytes': [{ ...funcionarioValido(), senha: 'a'.repeat(73) }, /72 bytes/],
        'cpf curto': [{ ...funcionarioValido(), cpf: '123' }, /CPF deve ter 11 dígitos/],
        'cpf com letras': [{ ...funcionarioValido(), cpf: 'abc.def.ghi-jk' }, /CPF/],
        'telefone com letras': [{ ...funcionarioValido(), telefone: 'ligue-me-ja-por-favor' }, /Telefone/],
        'data de admissão inexistente': [{ ...funcionarioValido(), data_admissao: '2024-02-30' }, /Data de admissão deve ser uma data válida/],
        'data de admissão em outro formato': [{ ...funcionarioValido(), data_admissao: '31/01/2024' }, /AAAA-MM-DD/],
        'data de admissão antes de 1900': [{ ...funcionarioValido(), data_admissao: '1899-12-31' }, /entre 1900-01-01/],
        'data de admissão muito à frente': [{ ...funcionarioValido(), data_admissao: '2999-01-01' }, /um ano à frente/],
        'nascimento no futuro': [{ ...funcionarioValido(), data_nascimento: '2999-01-01' }, /Data de nascimento deve estar entre/],
        'admissão antes do nascimento': [{ ...funcionarioValido(), data_nascimento: '2000-01-01', data_admissao: '1999-12-31' }, /anterior à data de nascimento/],
        'salário negativo': [{ ...funcionarioValido(), salario_base: -1 }, /Salário base/],
        'salário em texto livre': [{ ...funcionarioValido(), salario_base: 'abc' }, /Salário base/],
        'salário com 3 casas': [{ ...funcionarioValido(), salario_base: '10.123' }, /2 casas decimais/],
        'salário acima da coluna': [{ ...funcionarioValido(), salario_base: 100000000 }, /entre 0 e 99999999.99/],
        'salário em notação científica': [{ ...funcionarioValido(), salario_base: 1e21 }, /Salário base/],
        'salário booleano': [{ ...funcionarioValido(), salario_base: true }, /Salário base/],
        'cargo não numérico': [{ ...funcionarioValido(), cargo_id: 'abc' }, /Cargo deve ser um número inteiro positivo/],
        'cargo zero': [{ ...funcionarioValido(), cargo_id: 0 }, /Cargo/],
        'departamento acima do INT': [{ ...funcionarioValido(), departamento_id: 2147483648 }, /Departamento/],
        'tipo de contrato fora da lista': [{ ...funcionarioValido(), tipo_contrato: 'Escravo' }, /Tipo de contrato deve ser um destes valores: CLT, PJ/],
        'tipo de conta fora da lista': [{ ...funcionarioValido(), tipo_conta: 'Cripto' }, /Tipo de conta deve ser um destes valores/],
        'agência com 21 caracteres': [{ ...funcionarioValido(), agencia: '1'.repeat(21) }, /Agência deve ter no máximo 20/],
        'endereço com 501 caracteres': [{ ...funcionarioValido(), endereco: 'a'.repeat(501) }, /Endereço deve ter no máximo 500/],
    };
    for (const [nome, [entrada, mensagem]] of Object.entries(recusas)) {
        it(`recusa ${nome}`, () => recusa(criarFuncionario, entrada, mensagem));
    }
});

describe('schema de edição de funcionário', () => {
    it('assume Ativo quando o status não vem', () => {
        assert.equal(atualizarFuncionario.safeParse(edicaoValida()).data.status, 'Ativo');
        assert.equal(atualizarFuncionario.safeParse({ ...edicaoValida(), status: '' }).data.status, 'Ativo');
    });

    it('aceita os três status do banco', () => {
        for (const status of ['Ativo', 'Inativo', 'Férias']) {
            assert.equal(atualizarFuncionario.safeParse({ ...edicaoValida(), status }).data.status, status);
        }
    });

    it('recusa status fora do ENUM do banco', () => recusa(atualizarFuncionario, { ...edicaoValida(), status: 'Demitido' }, /Status deve ser um destes valores: Ativo, Inativo, Férias/));
    it('exige e-mail', () => recusa(atualizarFuncionario, { nome: 'Pessoa Ficticia' }, /E-mail é obrigatório/));
    it('recusa a senha enviada junto, em vez de ignorá-la em silêncio', () => recusa(atualizarFuncionario, { ...edicaoValida(), senha: 'senha-ficticia' }, /Campo desconhecido: senha/));
});

describe('schemas de estrutura', () => {
    it('normaliza departamento', () => {
        const { success, data } = estrutura.departamento.safeParse({ nome: ' TI ', sigla: 'TI', descricao: '', gestor: undefined });
        assert.equal(success, true);
        assert.deepEqual(data, { nome: 'TI', sigla: 'TI', descricao: null, gestor: null });
    });

    for (const [nome, [entrada, mensagem]] of Object.entries({
        'departamento sem nome': [{ sigla: 'TI' }, /Nome do departamento é obrigatório/],
        'departamento sem sigla': [{ nome: 'TI' }, /Sigla é obrigatório|Sigla é obrigatória/],
        'sigla com 11 caracteres': [{ nome: 'TI', sigla: 'ABCDEFGHIJK' }, /Sigla deve ter no máximo 10/],
        'descrição com 1001 caracteres': [{ nome: 'TI', sigla: 'TI', descricao: 'a'.repeat(1001) }, /Descrição deve ter no máximo 1000/],
    })) {
        it(`recusa ${nome}`, () => recusa(estrutura.departamento, entrada, mensagem));
    }

    it('normaliza cargo e assume salário zero', () => {
        const { success, data } = estrutura.cargo.safeParse({ nome: 'Analista', departamento_id: '4', nivel: 'Pleno' });
        assert.equal(success, true);
        assert.deepEqual(data, { nome: 'Analista', departamento_id: 4, nivel: 'Pleno', salario_base: 0 });
    });

    for (const [nome, [entrada, mensagem]] of Object.entries({
        'cargo sem departamento': [{ nome: 'Analista' }, /Departamento é obrigatório/],
        'cargo com departamento nulo': [{ nome: 'Analista', departamento_id: null }, /Departamento é obrigatório/],
        'cargo com salário negativo': [{ nome: 'Analista', departamento_id: 1, salario_base: -5 }, /Salário base/],
        'cargo com nível de 51 caracteres': [{ nome: 'Analista', departamento_id: 1, nivel: 'a'.repeat(51) }, /Nível deve ter no máximo 50/],
    })) {
        it(`recusa ${nome}`, () => recusa(estrutura.cargo, entrada, mensagem));
    }

    it('valida o id da rota', () => {
        assert.equal(estrutura.idDaRota.safeParse({ id: '12' }).data.id, 12);
        for (const id of ['abc', '0', '-1', '1.5', '12abc', '99999999999']) recusa(estrutura.idDaRota, { id }, /Identificador/);
    });
});

describe('schemas de perfil', () => {
    const base = () => ({ nome: 'Pessoa Ficticia', email: 'pessoa@exemplo.invalid' });

    it('aceita perfil sem telefone e sem avatar', () => {
        const { success, data } = atualizarMeusDados.safeParse({ ...base(), telefone: '', avatar: '' });
        assert.equal(success, true);
        assert.equal(data.telefone, null);
        assert.equal(data.avatar, null);
    });

    it('aceita os formatos de imagem suportados', () => {
        for (const formato of ['png', 'jpeg', 'gif', 'webp']) {
            assert.equal(atualizarMeusDados.safeParse({ ...base(), avatar: dataUrl(formato) }).success, true, formato);
        }
    });

    for (const [nome, [entrada, mensagem]] of Object.entries({
        'nome ausente': [{ email: 'a@b.co' }, /Nome é obrigatório/],
        'e-mail inválido': [{ ...base(), email: 'x' }, /e-mail válido/],
        'avatar que não é data URL': [{ ...base(), avatar: 'http://exemplo.invalid/a.png' }, /data URL base64/],
        'avatar numérico': [{ ...base(), avatar: 123 }, /data URL base64/],
        'avatar HTML': [{ ...base(), avatar: 'data:text/html;base64,PHNjcmlwdD4=' }, /Formato de avatar não suportado \(text\/html\)/],
        'avatar SVG': [{ ...base(), avatar: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, /Formato de avatar não suportado \(image\/svg\+xml\)/],
        'avatar PNG que é outra coisa': [{ ...base(), avatar: dataUrl('jpeg', 64, 'png') }, /não é uma imagem PNG válida/],
        'avatar com base64 quebrado': [{ ...base(), avatar: 'data:image/png;base64,@@@@' }, /base64 válido/],
        'avatar vazio após o cabeçalho': [{ ...base(), avatar: 'data:image/png;base64,' }, /base64 válido/],
        'avatar acima de 2 MB': [{ ...base(), avatar: dataUrl('png', TAMANHO_MAXIMO_BYTES + 1) }, /no máximo 2 MB/],
        'telefone com letras': [{ ...base(), telefone: 'abc' }, /Telefone/],
    })) {
        it(`recusa ${nome}`, () => recusa(atualizarMeusDados, entrada, mensagem));
    }

    it('aceita avatar de exatamente 2 MB', () => {
        assert.equal(validarAvatar(dataUrl('png', TAMANHO_MAXIMO_BYTES)), null);
    });

    it('exige senha atual e aplica a política de senha à nova', () => {
        assert.equal(alterarSenha.safeParse({ senhaAtual: 'x', novaSenha: 'senha-nova-ficticia' }).success, true);
        recusa(alterarSenha, { novaSenha: 'senha-nova-ficticia' }, /Informe a senha atual/);
        recusa(alterarSenha, { senhaAtual: 'x'.repeat(129), novaSenha: 'senha-nova-ficticia' }, /no máximo 128/);
        recusa(alterarSenha, { senhaAtual: 'x', novaSenha: 'curta' }, /mínimo 8/);
        recusa(alterarSenha, { senhaAtual: 'x', novaSenha: 'ã'.repeat(40) }, /72 bytes/);
        recusa(alterarSenha, { senhaAtual: { $ne: '' }, novaSenha: 'senha-nova-ficticia' }, /senha atual deve ser um texto/);
    });
});

describe('schema de paginação', () => {
    it('usa a primeira página com o limite padrão', () => {
        assert.deepEqual(paginacao.safeParse({}).data, { pagina: 1, limite: 500 });
        assert.deepEqual(paginacao.safeParse({ pagina: '', limite: '' }).data, { pagina: 1, limite: 500 });
    });

    it('aceita os extremos', () => {
        assert.deepEqual(paginacao.safeParse({ pagina: '3', limite: '1000' }).data, { pagina: 3, limite: 1000 });
        assert.equal(paginacao.safeParse({ limite: '1' }).data.limite, 1);
    });

    for (const [nome, entrada, mensagem] of [
        ['limite zero', { limite: '0' }, /limite deve ser um número inteiro entre 1 e 1000/],
        ['limite acima do máximo', { limite: '1001' }, /limite/],
        ['limite não numérico', { limite: 'todos' }, /limite/],
        ['limite negativo', { limite: '-5' }, /limite/],
        ['limite decimal', { limite: '1.5' }, /limite/],
        ['limite repetido (array)', { limite: ['1', '2'] }, /limite/],
        ['página zero', { pagina: '0' }, /pagina deve ser um número inteiro entre 1/],
        ['página não numérica', { pagina: 'abc' }, /pagina/],
    ]) {
        it(`recusa ${nome}`, () => recusa(paginacao, entrada, mensagem));
    }
});

describe('traduzirErro', () => {
    it('traduz falhas conhecidas do banco em 4xx com mensagem acionável', () => {
        const casos = [
            [{ code: 'ER_DATA_TOO_LONG', sqlMessage: "Data too long for column 'sigla' at row 1" }, 400, /campo sigla/],
            [{ code: 'ER_TRUNCATED_WRONG_VALUE', sqlMessage: "Incorrect date value: 'x' for column 'data_admissao' at row 1" }, 400, /campo data_admissao/],
            [{ code: 'ER_WARN_DATA_OUT_OF_RANGE', sqlMessage: "Out of range value for column 'salario_base' at row 1" }, 400, /campo salario_base/],
            [{ code: 'ER_BAD_NULL_ERROR', sqlMessage: "Column 'email' cannot be null" }, 400, /campo email/],
            [{ code: 'ER_NO_REFERENCED_ROW_2' }, 400, /não existe/],
            [{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'a@b.co' for key 'usuarios.email'" }, 409, /e-mail já está registado/],
            [{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry '1' for key 'x.PRIMARY'" }, 409, /Já existe um registro/],
            [{ code: 'ER_ROW_IS_REFERENCED_2' }, 409, /registros vinculados/],
            [{ code: 'ER_QUERY_TIMEOUT' }, 503, /demorou mais/],
        ];
        for (const [erro, status, mensagem] of casos) {
            const traduzido = traduzirErro(erro);
            assert.equal(traduzido.status, status, erro.code);
            assert.match(traduzido.erro, mensagem, erro.code);
        }
    });

    it('trata a fila cheia do pool como 503 com Retry-After', () => {
        const traduzido = traduzirErro(new Error('Queue limit reached.'));
        assert.equal(traduzido.status, 503);
        assert.equal(traduzido.retryAfter, 5);
    });

    it('deixa o que não conhece como 500', () => {
        assert.equal(traduzirErro(new Error('qualquer coisa')), null);
        assert.equal(traduzirErro({ code: 'ER_ACCESS_DENIED_ERROR' }), null);
        assert.equal(traduzirErro(undefined), null);
    });
});
