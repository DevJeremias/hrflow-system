import { z, campo, ausente, opcional, texto, email, senhaNova, inteiroPositivo, dinheiro, data, telefone, enumerado, corpoEstrito, hoje } from '../../shared/schemas/comum.ts';
import { LIMITES } from '../../shared/schemas/validadores.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';
import { normalizarCpf, normalizarPis, UFS } from './funcionarios.regras.ts';

const STATUS = ['Ativo', 'Inativo', 'Férias'] as const;
const TIPOS_CONTRATO = ['CLT', 'PJ', 'Estágio', 'Temporário'] as const;
const TIPOS_CONTA = ['Corrente', 'Poupanca', 'Salario'] as const;

export type Status = typeof STATUS[number];

const TIPOS_DE_PARENTESCO = ['Filho(a)', 'Cônjuge', 'Enteado(a)', 'Pai ou mãe', 'Outro'] as const;

// Documento que a API guarda só com os dígitos: aceita a pontuação de quem digita e recusa o que
// não fecha os dígitos verificadores.
const documento = (rotulo: string, normalizar: (valor: string) => string | null, dica: string) => campo((valor: unknown) => {
    if (typeof valor !== 'string') return { erro: `${rotulo} deve ser um texto.` };
    const digitos = normalizar(valor.trim());
    return digitos ? { valor: digitos } : { erro: `${rotulo} inválido: ${dica}.` };
});

const cpf = documento('CPF', normalizarCpf, 'confira os 11 dígitos');
const pis = documento('PIS', normalizarPis, 'confira os 11 dígitos');

const cep = campo((valor: unknown) => {
    const digitos = typeof valor === 'string' ? valor.replace(/[-.\s]/g, '') : '';
    return /^\d{8}$/.test(digitos) ? { valor: digitos } : { erro: 'CEP inválido: informe os 8 dígitos.' };
});

const uf = campo((valor: unknown) => {
    const sigla = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
    return (UFS as readonly string[]).includes(sigla) ? { valor: sigla } : { erro: 'UF inválida: use a sigla do estado (PA, SP...).' };
});

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
    matricula: opcional(texto('Matrícula', 20)),
    rg: opcional(texto('RG', 20)),
    pis: opcional(pis),
    ctps: opcional(texto('CTPS', 20)),
    cep: opcional(cep),
    logradouro: opcional(texto('Logradouro', 150)),
    numero: opcional(texto('Número', 20)),
    complemento: opcional(texto('Complemento', 100)),
    bairro: opcional(texto('Bairro', 100)),
    cidade: opcional(texto('Cidade', 100)),
    uf: opcional(uf),
    contato_emergencia_nome: opcional(texto('Nome do contato de emergência', 100)),
    contato_emergencia_telefone: opcional(telefone),
    contato_emergencia_parentesco: opcional(texto('Parentesco do contato de emergência', 50)),
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

// Na edição parcial, a chave ausente deixa o dado como está; só o que vem no corpo é gravado (null
// limpa o campo). Sem isto, `opcional` trataria o que faltou como "apagar".
const todosOpcionais = (formato: Record<string, z.ZodType>) =>
    Object.fromEntries(Object.entries(formato).map(([chave, schema]) => [chave, schema.optional()]));

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

// O status do cadastro novo é sempre Ativo: o campo, se enviado, é aceito e ignorado.
export const criarFuncionario = corpoEstrito({ ...dadosDoFuncionario, senha: senhaNova, status: z.unknown().optional().transform(() => undefined) }).check(admissaoDepoisDoNascimento);

// O status não entra aqui: muda só por PATCH /:id/status, que exige data e motivo ao desligar. A
// admissão contra o nascimento se confere no serviço, com o que já está gravado.
export const atualizarFuncionario = corpoEstrito(todosOpcionais(dadosDoFuncionario)).check((ctx) => {
    if (Object.keys(ctx.value as object).length === 0) {
        ctx.issues.push({ code: 'custom', message: 'Envie ao menos um campo para alterar.', input: ctx.value });
    }
});

export const idDoDependente = z.object({ id: inteiroPositivo('Identificador'), dependenteId: inteiroPositivo('Dependente') });

export const dependente = corpoEstrito({
    nome: texto('Nome do dependente', LIMITES.nome),
    parentesco: enumerado('Parentesco', TIPOS_DE_PARENTESCO),
    data_nascimento: data('Data de nascimento', hoje, 'a data de hoje'),
    cpf: opcional(cpf),
});

// O arquivo CSV chega como texto (Content-Type: text/csv); o formato das linhas se confere uma a uma na importação.
export const arquivoCsv = z.string({ error: 'Envie o arquivo CSV no corpo da requisição, com Content-Type: text/csv.' })
    .refine((conteudo) => conteudo.trim() !== '', 'O arquivo CSV está vazio.');

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

export interface DadosDoFuncionario {
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    data_nascimento: string | null;
    data_admissao: string | null;
    matricula: string | null;
    rg: string | null;
    pis: string | null;
    ctps: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    contato_emergencia_nome: string | null;
    contato_emergencia_telefone: string | null;
    contato_emergencia_parentesco: string | null;
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

// Só as chaves enviadas: o que faltou não se altera.
export type CorpoDaEdicao = Partial<DadosDoFuncionario>;

export interface IdDoDependente extends IdDaRota {
    dependenteId: number;
}

export interface CorpoDoDependente {
    nome: string;
    parentesco: typeof TIPOS_DE_PARENTESCO[number];
    data_nascimento: string;
    cpf: string | null;
}

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
