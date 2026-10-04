// SEC-07: schemas de entrada de estrutura, perfil e paginação, mais a tradução de
// erros do MySQL. Funções puras: não precisam de banco.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ZodType } from 'zod';
import * as estrutura from '../modules/estrutura/estrutura.schemas.ts';
import { atualizarMeusDados, alterarSenha } from '../modules/perfil/perfil.schemas.ts';
import { paginacao } from '../shared/schemas/paginacao.ts';
import { TAMANHO_MAXIMO_BYTES } from '../modules/funcionarios/index.ts';
import { traduzirErro } from '../shared/utils/erros.ts';
import { dataUrl } from './support/imagens.ts';

const mensagens = (resultado: { error?: { issues: { message: string }[] } }) => resultado.error?.issues.map((issue) => issue.message) ?? [];

const recusa = (schema: ZodType, entrada: unknown, esperado: RegExp) => {
    const resultado = schema.safeParse(entrada);
    assert.equal(resultado.success, false, `deveria recusar ${JSON.stringify(entrada)?.slice(0, 120)}`);
    assert.match(mensagens(resultado)[0], esperado);
};

describe('schemas de estrutura', () => {
    it('normaliza departamento', () => {
        const { success, data } = estrutura.departamento.safeParse({ nome: ' TI ', sigla: 'TI', descricao: '', gestor: undefined });
        assert.equal(success, true);
        assert.deepEqual(data, { nome: 'TI', sigla: 'TI', descricao: null, gestor: null });
    });

    for (const [nome, [entrada, mensagem]] of Object.entries<[unknown, RegExp]>({
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

    for (const [nome, [entrada, mensagem]] of Object.entries<[unknown, RegExp]>({
        'cargo sem departamento': [{ nome: 'Analista' }, /Departamento é obrigatório/],
        'cargo com departamento nulo': [{ nome: 'Analista', departamento_id: null }, /Departamento é obrigatório/],
        'cargo com salário negativo': [{ nome: 'Analista', departamento_id: 1, salario_base: -5 }, /Salário base/],
        'cargo com nível de 51 caracteres': [{ nome: 'Analista', departamento_id: 1, nivel: 'a'.repeat(51) }, /Nível deve ter no máximo 50/],
    })) {
        it(`recusa ${nome}`, () => recusa(estrutura.cargo, entrada, mensagem));
    }

    it('valida o id da rota', () => {
        assert.equal(estrutura.idDaRota.safeParse({ id: '12' }).data?.id, 12);
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

    for (const [nome, [entrada, mensagem]] of Object.entries<[unknown, RegExp]>({
        'nome vazio': [{ nome: '' }, /Nome é obrigatório/],
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
        assert.equal(paginacao.safeParse({ limite: '1' }).data?.limite, 1);
    });

    const casosDeEntrada: [string, unknown, RegExp][] = [
        ['limite zero', { limite: '0' }, /limite deve ser um número inteiro entre 1 e 1000/],
        ['limite acima do máximo', { limite: '1001' }, /limite/],
        ['limite não numérico', { limite: 'todos' }, /limite/],
        ['limite negativo', { limite: '-5' }, /limite/],
        ['limite decimal', { limite: '1.5' }, /limite/],
        ['limite repetido (array)', { limite: ['1', '2'] }, /limite/],
        ['página zero', { pagina: '0' }, /pagina deve ser um número inteiro entre 1/],
        ['página não numérica', { pagina: 'abc' }, /pagina/],
    ];
    for (const [nome, entrada, mensagem] of casosDeEntrada) {
        it(`recusa ${nome}`, () => recusa(paginacao, entrada, mensagem));
    }
});

describe('traduzirErro', () => {
    it('traduz falhas conhecidas do banco em 4xx com mensagem acionável', () => {
        const casos: [{ code: string; sqlMessage?: string }, number, RegExp][] = [
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
            assert.ok(traduzido);
            assert.equal(traduzido.status, status, erro.code);
            assert.match(traduzido.erro, mensagem, erro.code);
        }
    });

    it('trata a fila cheia do pool como 503 com Retry-After', () => {
        const traduzido = traduzirErro(new Error('Queue limit reached.'));
        assert.ok(traduzido);
        assert.equal(traduzido.status, 503);
        assert.equal(traduzido.retryAfter, 5);
    });

    it('deixa o que não conhece como 500', () => {
        assert.equal(traduzirErro(new Error('qualquer coisa')), null);
        assert.equal(traduzirErro({ code: 'ER_ACCESS_DENIED_ERROR' }), null);
        assert.equal(traduzirErro(undefined), null);
    });
});
