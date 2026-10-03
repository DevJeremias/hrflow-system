const { z, opcional, texto, textoLivre, email, senhaNova, inteiroPositivo, dinheiro, data, padrao, telefone, enumerado, corpoEstrito, hoje } = require('./comum');
const { LIMITES } = require('../modules/auth/auth.schemas.ts');

const STATUS = ['Ativo', 'Inativo', 'Férias'];
const TIPOS_CONTRATO = ['CLT', 'PJ', 'Estágio', 'Temporário'];
const TIPOS_CONTA = ['Corrente', 'Poupanca', 'Salario'];

const cpf = padrao(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF', 'ter 11 dígitos, com ou sem pontuação (000.000.000-00)');

const umAnoDepois = () => {
    const limite = new Date();
    limite.setUTCFullYear(limite.getUTCFullYear() + 1);
    return limite.toISOString().slice(0, 10);
};

const dadosDoFuncionario = {
    nome: texto('Nome', LIMITES.nome),
    email,
    cpf: opcional(cpf),
    telefone: opcional(telefone),
    data_nascimento: opcional(data('Data de nascimento', hoje, 'a data de hoje')),
    data_admissao: opcional(data('Data de admissão', umAnoDepois, 'um ano à frente de hoje')),
    endereco: opcional(textoLivre('Endereço', 500)),
    banco: opcional(texto('Banco', 100)),
    agencia: opcional(texto('Agência', 20)),
    conta: opcional(texto('Conta', 20)),
    tipo_conta: opcional(enumerado('Tipo de conta', TIPOS_CONTA)),
    cargo_id: opcional(inteiroPositivo('Cargo')),
    departamento_id: opcional(inteiroPositivo('Departamento')),
    nivel: opcional(texto('Nível', 50)),
    tipo_contrato: opcional(enumerado('Tipo de contrato', TIPOS_CONTRATO)),
    salario_base: opcional(dinheiro('Salário base')),
};

// A admissão não pode ser anterior ao nascimento; só se compara quando as duas datas são válidas.
const admissaoDepoisDoNascimento = (ctx) => {
    const { data_nascimento: nascimento, data_admissao: admissao } = ctx.value;
    if (nascimento && admissao && admissao < nascimento) {
        ctx.issues.push({
            code: 'custom',
            message: 'Data de admissão não pode ser anterior à data de nascimento.',
            path: ['data_admissao'],
            input: admissao,
        });
    }
};

const idDaRota = z.object({ id: inteiroPositivo('Identificador') });

// O status do cadastro novo é sempre Ativo: o campo, se enviado, é aceito e ignorado.
const criarFuncionario = corpoEstrito({ ...dadosDoFuncionario, senha: senhaNova, status: z.unknown().optional().transform(() => undefined) }).check(admissaoDepoisDoNascimento);

const atualizarFuncionario = corpoEstrito({
    ...dadosDoFuncionario,
    status: opcional(enumerado('Status', STATUS)).transform((status) => status ?? 'Ativo'),
}).check(admissaoDepoisDoNascimento);

module.exports = { STATUS, TIPOS_CONTRATO, TIPOS_CONTA, idDaRota, criarFuncionario, atualizarFuncionario };
