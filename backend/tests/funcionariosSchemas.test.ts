// Schemas de cadastro e edição de funcionário e a validação do avatar. Funções puras: não precisam
// de banco.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ZodType } from 'zod';
import { criarFuncionario, atualizarFuncionario } from '../modules/funcionarios/funcionarios.schemas.ts';
import { validarAvatar, TAMANHO_MAXIMO_BYTES } from '../modules/funcionarios/index.ts';
import { dataUrl } from './support/imagens.ts';

const recusa = (schema: ZodType, entrada: unknown, esperado: RegExp) => {
    const resultado = schema.safeParse(entrada);
    assert.equal(resultado.success, false, `deveria recusar ${JSON.stringify(entrada)?.slice(0, 120)}`);
    assert.match(resultado.error!.issues[0].message, esperado);
};

// Entrada aceita pelo schema, normalizada.
const aceita = (schema: ZodType, entrada: unknown): Record<string, unknown> => {
    const resultado = schema.safeParse(entrada);
    assert.equal(resultado.success, true, `deveria aceitar ${JSON.stringify(entrada)?.slice(0, 120)}`);
    return resultado.data as Record<string, unknown>;
};

const funcionarioValido = () => ({ nome: 'Pessoa Ficticia', email: 'Pessoa@Exemplo.invalid', senha: 'senha-ficticia' });
// A edição não aceita senha (quem troca é o próprio usuário no perfil).
const edicaoValida = () => ({ nome: 'Pessoa Ficticia', email: 'Pessoa@Exemplo.invalid' });

describe('schema de cadastro de funcionário', () => {
    it('normaliza uma entrada completa', () => {
        const data = aceita(criarFuncionario, {
            ...funcionarioValido(), nome: '  Pessoa Ficticia  ', cpf: '000.000.000-01', telefone: '(00) 90000-0000',
            data_nascimento: '1990-05-17', data_admissao: '2024-02-29', endereco: 'Rua Ficticia, 1', banco: 'Banco Ficticio',
            agencia: '0001', conta: '12345-6', tipo_conta: 'Corrente', cargo_id: '7', departamento_id: 3,
            nivel: ' Pleno ', tipo_contrato: 'CLT', salario_base: '3500.50', status: 'Qualquer',
        });
        assert.equal(data.nome, 'Pessoa Ficticia');
        assert.equal(data.email, 'pessoa@exemplo.invalid');
        assert.equal(data.cargo_id, 7);
        assert.equal(data.salario_base, 3500.5);
        assert.equal(data.status, undefined, 'o status do cadastro novo não vem do cliente');
        assert.equal(data.nivel, 'Pleno');
    });

    it('trata campos em branco como ausentes, como os formulários enviam', () => {
        const data = aceita(criarFuncionario, {
            ...funcionarioValido(), cpf: '', telefone: ' ', data_admissao: '', cargo_id: null, salario_base: '', tipo_contrato: '',
        });
        for (const chave of ['cpf', 'telefone', 'data_admissao', 'cargo_id', 'departamento_id', 'salario_base', 'tipo_contrato', 'banco']) {
            assert.equal(data[chave], null, chave);
        }
    });

    it('aceita salário zero e o maior valor da coluna', () => {
        assert.equal(aceita(criarFuncionario, { ...funcionarioValido(), salario_base: 0 }).salario_base, 0);
        assert.equal(aceita(criarFuncionario, { ...funcionarioValido(), salario_base: '99999999.99' }).salario_base, 99999999.99);
    });

    const recusas: Record<string, [unknown, RegExp]> = {
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
        assert.equal(aceita(atualizarFuncionario, edicaoValida()).status, 'Ativo');
        assert.equal(aceita(atualizarFuncionario, { ...edicaoValida(), status: '' }).status, 'Ativo');
    });

    it('aceita os três status do banco', () => {
        for (const status of ['Ativo', 'Inativo', 'Férias']) {
            assert.equal(aceita(atualizarFuncionario, { ...edicaoValida(), status }).status, status);
        }
    });

    it('recusa status fora do ENUM do banco', () => recusa(atualizarFuncionario, { ...edicaoValida(), status: 'Demitido' }, /Status deve ser um destes valores: Ativo, Inativo, Férias/));
    it('exige e-mail', () => recusa(atualizarFuncionario, { nome: 'Pessoa Ficticia' }, /E-mail é obrigatório/));
    it('recusa a senha enviada junto, em vez de ignorá-la em silêncio', () => recusa(atualizarFuncionario, { ...edicaoValida(), senha: 'senha-ficticia' }, /Campo desconhecido: senha/));
});

describe('validação do avatar', () => {
    it('aceita avatar de exatamente 2 MB', () => {
        assert.equal(validarAvatar(dataUrl('png', TAMANHO_MAXIMO_BYTES)), null);
    });

    it('aceita os formatos de imagem suportados', () => {
        for (const formato of ['png', 'jpeg', 'gif', 'webp']) assert.equal(validarAvatar(dataUrl(formato)), null, formato);
    });

    const recusas: Record<string, [unknown, RegExp]> = {
        'valor que não é texto': [123, /data URL base64/],
        'URL comum': ['http://exemplo.invalid/a.png', /data URL base64/],
        'formato fora da lista': ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', /Formato de avatar não suportado \(image\/svg\+xml\)/],
        'assinatura de outro formato': [dataUrl('jpeg', 64, 'png'), /não é uma imagem PNG válida/],
        'base64 quebrado': ['data:image/png;base64,@@@@', /base64 válido/],
        'acima de 2 MB': [dataUrl('png', TAMANHO_MAXIMO_BYTES + 1), /no máximo 2 MB/],
    };
    for (const [nome, [entrada, mensagem]] of Object.entries(recusas)) {
        it(`recusa ${nome}`, () => assert.match(validarAvatar(entrada) ?? '', mensagem));
    }
});
