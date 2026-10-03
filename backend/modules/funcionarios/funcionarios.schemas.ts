import { z, campo, ausente, opcional, texto, textoLivre, email, senhaNova, inteiroPositivo, dinheiro, data, padrao, telefone, enumerado, corpoEstrito, hoje } from '../../shared/schemas/comum.ts';
import { LIMITES } from '../../shared/schemas/validadores.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';

const STATUS = ['Ativo', 'Inativo', 'Férias'] as const;
const TIPOS_CONTRATO = ['CLT', 'PJ', 'Estágio', 'Temporário'] as const;
const TIPOS_CONTA = ['Corrente', 'Poupanca', 'Salario'] as const;
const PARENTESCOS = ['Cônjuge', 'Filho(a)', 'Pai ou mãe', 'Outro'] as const;

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

const TAMANHO_MAXIMO_DA_BUSCA = 100;

const busca = campo((valor: unknown) => {
    if (ausente(valor)) return { valor: null };
    if (typeof valor !== 'string') return { erro: 'Busca deve ser um texto.' };
    const limpo = valor.trim();
    return limpo.length > TAMANHO_MAXIMO_DA_BUSCA
        ? { erro: `Busca deve ter no máximo ${TAMANHO_MAXIMO_DA_BUSCA} caracteres.` }
        : { valor: limpo };
});

// Página, busca livre (nome, e-mail, CPF, cargo e departamento) e filtros da listagem.
export const consultaDeFuncionarios = paginacao.extend({
    busca,
    status: opcional(enumerado('Status', STATUS)),
    departamento_id: opcional(inteiroPositivo('Departamento')),
});

export const idDaRota = z.object({ id: inteiroPositivo('Identificador') });

export const dependenteDaRota = z.object({ id: inteiroPositivo('Identificador'), dependenteId: inteiroPositivo('Dependente') });

export const criarDependente = corpoEstrito({
    nome: texto('Nome', LIMITES.nome),
    parentesco: enumerado('Parentesco', PARENTESCOS),
    data_nascimento: opcional(data('Data de nascimento', hoje, 'a data de hoje')),
});

// O status do cadastro novo é sempre Ativo: o campo, se enviado, é aceito e ignorado.
export const criarFuncionario = corpoEstrito({ ...dadosDoFuncionario, senha: senhaNova, status: z.unknown().optional().transform(() => undefined) }).check(admissaoDepoisDoNascimento);

// O status não entra aqui: muda só por PATCH /:id/status, que exige data e motivo ao desligar.
export const atualizarFuncionario = corpoEstrito(dadosDoFuncionario).check(admissaoDepoisDoNascimento);

// Desligar é inativar com data e motivo; qualquer outro status limpa os dois.
export const alterarStatus = corpoEstrito({
    status: enumerado('Status', STATUS),
    data_desligamento: opcional(data('Data do desligamento', hoje, 'a data de hoje')),
    motivo_desligamento: opcional(texto('Motivo do desligamento', 255)),
}).check((ctx) => {
    const { status, data_desligamento: dataDoDesligamento, motivo_desligamento: motivo } = ctx.value as unknown as CorpoDoStatus;
    if (status === 'Inativo') {
        if (!dataDoDesligamento) ctx.issues.push({ code: 'custom', message: 'Data do desligamento é obrigatória para inativar.', path: ['data_desligamento'], input: dataDoDesligamento });
        if (!motivo) ctx.issues.push({ code: 'custom', message: 'Motivo do desligamento é obrigatório para inativar.', path: ['motivo_desligamento'], input: motivo });
        return;
    }
    if (dataDoDesligamento || motivo) {
        ctx.issues.push({ code: 'custom', message: 'Data e motivo do desligamento só valem para o status Inativo.', path: [dataDoDesligamento ? 'data_desligamento' : 'motivo_desligamento'], input: dataDoDesligamento ?? motivo });
    }
});

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface IdDaRota {
    id: number;
}

export interface DependenteDaRota {
    id: number;
    dependenteId: number;
}

export interface CorpoDoDependente {
    nome: string;
    parentesco: typeof PARENTESCOS[number];
    data_nascimento: string | null;
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

export type CorpoDaEdicao = DadosDoFuncionario;

export interface CorpoDoStatus {
    status: Status;
    data_desligamento: string | null;
    motivo_desligamento: string | null;
}

export interface Paginacao {
    pagina: number;
    limite: number;
}

export interface FiltrosDeFuncionarios {
    busca: string | null;
    status: Status | null;
    departamento_id: number | null;
}

export interface ConsultaDeFuncionarios extends Paginacao, FiltrosDeFuncionarios {}
