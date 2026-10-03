import { z, opcional, texto, textoLivre, email, senhaNova, inteiroPositivo, dinheiro, data, padrao, telefone, enumerado, corpoEstrito, hoje } from '../../schemas/comum.js';
import { LIMITES } from '../../utils/validacaoAuth.js';

const STATUS = ['Ativo', 'Inativo', 'Férias'] as const;
const TIPOS_CONTRATO = ['CLT', 'PJ', 'Estágio', 'Temporário'] as const;
const TIPOS_CONTA = ['Corrente', 'Poupanca', 'Salario'] as const;

export type Status = typeof STATUS[number];

const cpf = padrao(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF', 'ter 11 dígitos, com ou sem pontuação (000.000.000-00)');

const umAnoDepois = (): string => {
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
const admissaoDepoisDoNascimento = (ctx: z.core.ParsePayload<Record<string, unknown>>) => {
    const { data_nascimento: nascimento, data_admissao: admissao } = ctx.value as Pick<DadosDoFuncionario, 'data_nascimento' | 'data_admissao'>;
    if (nascimento && admissao && admissao < nascimento) {
        ctx.issues.push({
            code: 'custom',
            message: 'Data de admissão não pode ser anterior à data de nascimento.',
            path: ['data_admissao'],
            input: admissao,
        });
    }
};

export const idDaRota = z.object({ id: inteiroPositivo('Identificador') });

// O status do cadastro novo é sempre Ativo: o campo, se enviado, é aceito e ignorado.
export const criarFuncionario = corpoEstrito({ ...dadosDoFuncionario, senha: senhaNova, status: z.unknown().optional().transform(() => undefined) }).check(admissaoDepoisDoNascimento);

export const atualizarFuncionario = corpoEstrito({
    ...dadosDoFuncionario,
    status: opcional(enumerado('Status', STATUS)).transform((status: Status | null) => status ?? 'Ativo'),
}).check(admissaoDepoisDoNascimento);

// O que cada schema entrega em req.dadosValidados. schemas/comum.js ainda é JavaScript e seus
// construtores não declaram o tipo que devolvem, então estes tipos são escritos à mão: mude-os
// junto com o schema.
export interface IdDaRota {
    id: number;
}

export interface DadosDoFuncionario {
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    data_nascimento: string | null;
    data_admissao: string | null;
    endereco: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipo_conta: typeof TIPOS_CONTA[number] | null;
    cargo_id: number | null;
    departamento_id: number | null;
    nivel: string | null;
    tipo_contrato: typeof TIPOS_CONTRATO[number] | null;
    salario_base: number | null;
}

export interface CorpoDoCadastro extends DadosDoFuncionario {
    senha: string;
}

export interface CorpoDaEdicao extends DadosDoFuncionario {
    status: Status;
}

export interface Paginacao {
    pagina: number;
    limite: number;
}
