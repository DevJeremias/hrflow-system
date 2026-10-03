// Funções puras do SEC-07: validação de entrada de login/cadastro e leitura de TRUST_PROXY.
// Não precisam de banco.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarLogin, validarRegistro } from '../modules/auth/auth.schemas.ts';
import { interpretarTrustProxy } from '../shared/config/trustProxy.ts';

const registroValido = () => ({
    nomeEmpresa: 'Empresa Ficticia', nomeAdmin: 'Pessoa Ficticia', email: 'Admin@Exemplo.invalid', senha: 'senha-ficticia',
});

describe('validarRegistro', () => {
    it('normaliza e aceita uma entrada válida', () => {
        const { dados, erro } = validarRegistro({ ...registroValido(), nomeEmpresa: '  Empresa Ficticia  ' });
        assert.equal(erro, undefined);
        assert.ok(dados);
        assert.equal(dados.email, 'admin@exemplo.invalid');
        assert.equal(dados.nomeEmpresa, 'Empresa Ficticia');
    });

    const recusas: Record<string, [unknown, RegExp]> = {
        'corpo que não é objeto': [null, /JSON/],
        'corpo em array': [[registroValido()], /JSON/],
        'nome da empresa ausente': [{ ...registroValido(), nomeEmpresa: undefined }, /empresa/],
        'nome da empresa objeto': [{ ...registroValido(), nomeEmpresa: { $ne: '' } }, /empresa/],
        'nome da empresa em branco': [{ ...registroValido(), nomeEmpresa: '   ' }, /empresa/],
        'nome da empresa com 101 caracteres': [{ ...registroValido(), nomeEmpresa: 'a'.repeat(101) }, /100/],
        'nome do administrador com controle': [{ ...registroValido(), nomeAdmin: 'Pessoa\u0000Ficticia' }, /administrador/],
        'e-mail sem arroba': [{ ...registroValido(), email: 'sem-arroba' }, /e-mail/i],
        'e-mail com 101 caracteres': [{ ...registroValido(), email: `${'a'.repeat(90)}@exemplo.invalid` }, /100/],
        'senha numérica': [{ ...registroValido(), senha: 12345678 }, /Senha/],
        'senha curta': [{ ...registroValido(), senha: '1234567' }, /mínimo 8/],
        'senha acima de 72 bytes': [{ ...registroValido(), senha: 'a'.repeat(73) }, /72 bytes/],
        'senha de 40 caracteres que passa de 72 bytes': [{ ...registroValido(), senha: 'ã'.repeat(40) }, /72 bytes/],
    };
    for (const [nome, [corpo, mensagem]] of Object.entries(recusas)) {
        it(`recusa ${nome}`, () => {
            const { erro, dados } = validarRegistro(corpo);
            assert.equal(dados, undefined);
            assert.ok(erro);
            assert.match(erro, mensagem);
        });
    }

    it('aceita senha de exatamente 72 bytes', () => {
        assert.equal(validarRegistro({ ...registroValido(), senha: 'a'.repeat(72) }).erro, undefined);
    });
});

describe('validarLogin', () => {
    it('não aplica a política de cadastro, para contas legadas continuarem entrando', () => {
        const { dados, erro } = validarLogin({ email: 'legado@localhost', senha: 'x'.repeat(100) });
        assert.equal(erro, undefined);
        assert.ok(dados);
        assert.equal(dados.email, 'legado@localhost');
    });

    for (const [nome, corpo] of Object.entries({
        'corpo ausente': undefined,
        'e-mail objeto': { email: { $ne: '' }, senha: 'x' },
        'e-mail vazio': { email: '', senha: 'x' },
        'e-mail gigante': { email: 'a'.repeat(300), senha: 'x' },
        'senha ausente': { email: 'a@b.c' },
        'senha numérica': { email: 'a@b.c', senha: 123 },
        'senha gigante': { email: 'a@b.c', senha: 'x'.repeat(129) },
    })) {
        it(`recusa ${nome} com mensagem acionável`, () => {
            const { erro, dados } = validarLogin(corpo);
            assert.equal(dados, undefined);
            assert.equal(typeof erro, 'string');
        });
    }
});

describe('interpretarTrustProxy', () => {
    it('não confia em nenhum proxy por padrão', () => {
        for (const valor of [undefined, '', '  ', 'false', 'FALSE']) assert.equal(interpretarTrustProxy(valor), false);
    });

    it('aceita número de saltos e lista de sub-redes', () => {
        assert.equal(interpretarTrustProxy('1'), 1);
        assert.equal(interpretarTrustProxy(' loopback, 10.0.0.0/8 '), 'loopback, 10.0.0.0/8');
    });

    it('recusa true, que deixaria X-Forwarded-For forjável', () => {
        assert.throws(() => interpretarTrustProxy('true'), /TRUST_PROXY/);
    });
});
