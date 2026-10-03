import { z, campo, ausente, enumerado, inteiroPositivo, corpoEstrito, opcional, texto } from '../../shared/schemas/comum.ts';
import { LIMITES, validarTexto, validarEmail } from '../../shared/schemas/validadores.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';

const TIPOS_CONTA = ['Corrente', 'Poupanca', 'Salario'] as const;
const STATUS_DA_SOLICITACAO = ['pendente', 'aprovada', 'recusada', 'cancelada'] as const;

// Os dados que o colaborador não grava sozinho: nome, e-mail, endereço e dados bancários.
export const CAMPOS_DO_PEDIDO = ['nome', 'email', 'endereco', 'banco', 'agencia', 'conta', 'tipo_conta'] as const;
export type CampoDoPedido = typeof CAMPOS_DO_PEDIDO[number];
// Os que só existem no cadastro de colaborador (a conta de acesso guarda só nome e e-mail).
export const CAMPOS_DO_CADASTRO: readonly CampoDoPedido[] = ['endereco', 'banco', 'agencia', 'conta', 'tipo_conta'];

// Chave ausente fica como está (undefined); '' ou null limpam o dado (null).
const textoDoCadastro = (rotulo: string, maximo: number) => campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    if (ausente(valor)) return { valor: null };
    if (typeof valor !== 'string') return { erro: `${rotulo} deve ser um texto.` };
    const limpo = valor.trim();
    if (limpo.length > maximo) return { erro: `${rotulo} deve ter no máximo ${maximo} caracteres.` };
    if (limpo.includes('\u0000')) return { erro: `${rotulo} contém caracteres inválidos.` };
    return { valor: limpo };
});

const nomeDoPedido = campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    const erro = validarTexto(valor, 'Nome', LIMITES.nome);
    return erro ? { erro } : { valor: (valor as string).trim() };
});

const emailDoPedido = campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    const erro = validarEmail(valor);
    return erro ? { erro } : { valor: (valor as string).trim().toLowerCase() };
});

const tipoDeContaDoPedido = campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    if (ausente(valor)) return { valor: null };
    const resultado = enumerado('Tipo de conta', TIPOS_CONTA).safeParse(valor);
    return resultado.success ? { valor: resultado.data } : { erro: resultado.error.issues[0].message };
});

// A senha atual só é conferida contra o hash, então aceita qualquer texto até o limite do login.
export const senhaAtualDoPedido = campo((valor: unknown) => {
    if (valor === undefined) return { valor: undefined };
    if (typeof valor !== 'string') return { erro: 'A senha atual deve ser um texto.' };
    return valor.length > LIMITES.senhaLoginMax
        ? { erro: `A senha atual deve ter no máximo ${LIMITES.senhaLoginMax} caracteres.` }
        : { valor };
});

// Os campos do pedido, para os schemas de quem o recebe (POST aqui e PUT /api/perfil/meus-dados).
export const camposDoPedido = {
    nome: nomeDoPedido,
    email: emailDoPedido,
    endereco: textoDoCadastro('Endereço', 500),
    banco: textoDoCadastro('Banco', 100),
    agencia: textoDoCadastro('Agência', 20),
    conta: textoDoCadastro('Conta', 20),
    tipo_conta: tipoDeContaDoPedido,
    senhaAtual: senhaAtualDoPedido,
};

export const criarSolicitacao = corpoEstrito(camposDoPedido);

export const idDaRota = z.object({ id: inteiroPositivo('Identificador') });

export const consultaDeSolicitacoes = paginacao.extend({
    status: opcional(enumerado('Status', STATUS_DA_SOLICITACAO)),
});

export const decidirSolicitacao = corpoEstrito({
    status: enumerado('Decisão', ['aprovada', 'recusada'] as const),
    resposta: opcional(texto('Resposta', 500)),
});

// O que cada schema entrega em req.dadosValidados. Os tipos são escritos à mão: mude-os junto com
// o schema.
export interface PedidoDeAlteracao {
    nome?: string;
    email?: string;
    endereco?: string | null;
    banco?: string | null;
    agencia?: string | null;
    conta?: string | null;
    tipo_conta?: typeof TIPOS_CONTA[number] | null;
    senhaAtual?: string;
}

export interface IdDaRota {
    id: number;
}

export type StatusDaSolicitacao = typeof STATUS_DA_SOLICITACAO[number];

export interface ConsultaDeSolicitacoes {
    pagina: number;
    limite: number;
    status: StatusDaSolicitacao | null;
}

export interface CorpoDaDecisao {
    status: 'aprovada' | 'recusada';
    resposta: string | null;
}
