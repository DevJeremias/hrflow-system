// Regras das solicitações de alteração cadastral: o colaborador (e o RH, no que é dele) pede para mudar
// nome, e-mail, endereço ou dados bancários, e quem pode gerir aquele cadastro aprova ou recusa. Só a
// aprovação grava a mudança. O Administrador não pede: altera os próprios dados direto (ver o perfil).
// Não conhece HTTP (falhas de regra saem como ErroDeSolicitacao) e só chega ao banco pelo repositório.
import bcrypt from 'bcrypt';
import * as repositorio from './solicitacoes.repository.ts';
import type { ContaDoSolicitante, RepositorioDeSolicitacoes, SolicitacaoGravada } from './solicitacoes.repository.ts';
import { ErroDeSolicitacao } from './solicitacoes.erros.ts';
import { CAMPOS_DO_CADASTRO, CAMPOS_DO_PEDIDO } from './solicitacoes.schemas.ts';
import type { CampoDoPedido, ConsultaDeSolicitacoes, CorpoDaDecisao, PedidoDeAlteracao, StatusDaSolicitacao } from './solicitacoes.schemas.ts';
import type { Autoria } from '../../shared/utils/auditar.ts';
import { EMAIL_DUPLICADO } from '../../shared/utils/erros.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';
import { motivoDeNegacaoDoCadastro } from '../../shared/utils/permissoes.ts';

type Valores = Partial<Record<CampoDoPedido, string | null>>;

// Quem faz a requisição, como o token o descreve.
export interface Operador {
    id: number;
    empresa_id: number;
    perfil: string;
    funcionario_id: number | null;
}

// Formato que o front-end consome (frontend/src/services/solicitacoesAlteracaoService.ts).
export interface SolicitacaoDeAlteracao {
    id: number;
    status: StatusDaSolicitacao;
    solicitante: { nome: string; perfil: string };
    alteracoes: Valores;
    anteriores: Valores;
    resposta: string | null;
    decidido_por: string | null;
    decidido_em: string | null;
    criado_em: string;
}

const paraIso = (segundos: number): string => new Date(segundos * 1000).toISOString();

const solicitacaoDe = (linha: SolicitacaoGravada): SolicitacaoDeAlteracao => ({
    id: linha.id,
    status: linha.status,
    solicitante: { nome: linha.solicitante_nome, perfil: linha.solicitante_perfil },
    alteracoes: linha.alteracoes,
    anteriores: linha.anteriores,
    resposta: linha.resposta,
    decidido_por: linha.decidido_por_nome,
    decidido_em: linha.decidido_em === null ? null : paraIso(linha.decidido_em),
    criado_em: paraIso(linha.criado_em),
});

// O que está gravado nos campos do pedido: a conta de quem pede ou o perfil que ela vê de si mesma.
type DadosAtuais = Record<CampoDoPedido, string | null>;

const valorAtual = (conta: DadosAtuais, campo: CampoDoPedido): string | null => conta[campo] ?? null;

// O que o pedido muda de verdade: o que veio e é diferente do que está gravado.
export const camposAlterados = (conta: DadosAtuais, pedido: Omit<PedidoDeAlteracao, 'senhaAtual'>): { alteracoes: Valores; anteriores: Valores } => {
    const alteracoes: Valores = {};
    const anteriores: Valores = {};
    for (const campo of CAMPOS_DO_PEDIDO) {
        const novo = pedido[campo];
        if (novo === undefined || novo === valorAtual(conta, campo)) continue;
        alteracoes[campo] = novo;
        anteriores[campo] = valorAtual(conta, campo);
    }
    return { alteracoes, anteriores };
};

// Ao alterar o e-mail de login a pessoa prova que é ela: a senha atual precisa estar certa.
export const exigirSenhaAtual = async (hash: string, senhaAtual: string | undefined): Promise<void> => {
    if (senhaAtual === undefined || senhaAtual === '') throw new ErroDeSolicitacao('invalido', 'Informe a senha atual para trocar o e-mail.');
    if (!await bcrypt.compare(senhaAtual, hash)) throw new ErroDeSolicitacao('invalido', 'A senha atual está incorreta.');
};

const semCadastro = (conta: ContaDoSolicitante, alteracoes: Valores): boolean =>
    conta.funcionario_id === null && CAMPOS_DO_CADASTRO.some((campo) => campo in alteracoes);

const SO_CADASTRO = 'Só quem tem cadastro de colaborador pode pedir a alteração de endereço ou dados bancários.';

// Registra o pedido e cancela o pendente anterior da mesma conta. Devolve o pedido criado.
export const criarSolicitacao = async (operador: Operador, autoria: Autoria, pedido: PedidoDeAlteracao): Promise<SolicitacaoDeAlteracao> => {
    if (operador.perfil === 'Administrador') {
        throw new ErroDeSolicitacao('invalido', 'O Administrador altera os próprios dados diretamente, sem solicitação.');
    }
    const id = await repositorio.emTransacao(async (repo) => {
        const conta = await repo.contaDoSolicitante(operador.id, operador.empresa_id, true);
        if (!conta) throw new ErroDeSolicitacao('inexistente', 'Conta não encontrada.');
        const { alteracoes, anteriores } = camposAlterados(conta, pedido);
        if (Object.keys(alteracoes).length === 0) {
            throw new ErroDeSolicitacao('invalido', 'Os dados informados são iguais aos atuais: não há o que solicitar.');
        }
        if (semCadastro(conta, alteracoes)) throw new ErroDeSolicitacao('invalido', SO_CADASTRO);
        if ('email' in alteracoes) {
            await exigirSenhaAtual(conta.senha, pedido.senhaAtual);
            if (await repo.emailEmUsoPorOutro(alteracoes.email as string, conta.id)) {
                throw new ErroDeSolicitacao('invalido', EMAIL_DUPLICADO, { detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] });
            }
        }

        await repo.cancelarPendentes(conta.id, operador.empresa_id);
        const novo = await repo.inserir(operador.empresa_id, conta.id, conta.funcionario_id, alteracoes, anteriores);
        await repo.auditar(autoria, { acao: 'solicitacao.criada', entidade: 'solicitacao', entidadeId: novo, funcionarioId: conta.funcionario_id, antes: anteriores, depois: alteracoes });
        return novo;
    });
    return solicitacaoDe((await repositorio.buscar(id, operador.empresa_id))!);
};

export const minhasSolicitacoes = async (operador: Operador): Promise<SolicitacaoDeAlteracao[]> =>
    (await repositorio.dasMinhas(operador.id, operador.empresa_id)).map(solicitacaoDe);

export interface PaginaDeSolicitacoes {
    solicitacoes: SolicitacaoDeAlteracao[];
    total: number;
}

// O Administrador vê os pedidos de todos; o RH, só os de Colaboradores (os dele e os de outro RH são
// do Administrador).
export const listarSolicitacoes = async (operador: Operador, { status, ...paginacao }: ConsultaDeSolicitacoes): Promise<PaginaDeSolicitacoes> => {
    const [limite, deslocamento] = limiteEDeslocamento(paginacao);
    const filtro = { empresaId: operador.empresa_id, status, soColaboradores: operador.perfil !== 'Administrador' };
    const linhas = await repositorio.listarDaEmpresa(filtro, limite, deslocamento);
    return { solicitacoes: linhas.map(solicitacaoDe), total: await repositorio.contarDaEmpresa(filtro) };
};

// Grava no cadastro e na conta o que foi aprovado. O e-mail pode ter sido tomado por outra conta desde o
// pedido: nesse caso a aprovação falha e o gestor recusa.
const aplicar = async (repo: RepositorioDeSolicitacoes, empresaId: number, conta: ContaDoSolicitante, alteracoes: Valores): Promise<void> => {
    if (conta.anonimizado_em) throw new ErroDeSolicitacao('conflito', 'O cadastro foi anonimizado: o pedido não pode mais ser aplicado.');
    if (alteracoes.email && await repo.emailEmUsoPorOutro(alteracoes.email, conta.id)) {
        throw new ErroDeSolicitacao('conflito', 'O e-mail pedido já é usado por outra conta. Recuse a solicitação.');
    }
    if (conta.funcionario_id !== null) await repo.aplicarNoCadastro(conta.funcionario_id, empresaId, alteracoes);
    await repo.aplicarNaConta(conta.id, empresaId, { nome: alteracoes.nome ?? undefined, email: alteracoes.email ?? undefined });
};

export const decidirSolicitacao = async (operador: Operador, autoria: Autoria, id: number, { status, resposta }: CorpoDaDecisao): Promise<SolicitacaoDeAlteracao> => {
    await repositorio.emTransacao(async (repo) => {
        const solicitacao = await repo.buscar(id, operador.empresa_id, true);
        if (!solicitacao) throw new ErroDeSolicitacao('inexistente', 'Solicitação não encontrada.');
        if (solicitacao.status !== 'pendente') throw new ErroDeSolicitacao('conflito', `Esta solicitação já está ${solicitacao.status}.`);

        // Quem gere o cadastro decide o pedido dele: o RH não decide o próprio pedido nem o de outro RH.
        const motivo = motivoDeNegacaoDoCadastro(
            { perfil: operador.perfil, funcionario_id: operador.funcionario_id },
            { id: solicitacao.funcionario_id ?? -1, perfilDaConta: solicitacao.solicitante_perfil }
        );
        if (motivo) throw new ErroDeSolicitacao('proibido', 'Só um Administrador decide o pedido de quem tem acesso de RH ou Administrador, e ninguém decide o próprio pedido.');

        const conta = (await repo.contaDoSolicitante(solicitacao.usuario_id, operador.empresa_id, true))!;
        if (status === 'aprovada') {
            // O "antes" da trilha é o que está gravado agora, que pode diferir do que valia no pedido.
            const antes = Object.fromEntries(Object.keys(solicitacao.alteracoes).map((campo) => [campo, valorAtual(conta, campo as CampoDoPedido)]));
            await aplicar(repo, operador.empresa_id, conta, solicitacao.alteracoes);
            await repo.auditar(autoria, { acao: 'solicitacao.aprovada', entidade: 'solicitacao', entidadeId: id, funcionarioId: solicitacao.funcionario_id, antes, depois: solicitacao.alteracoes });
        } else {
            await repo.auditar(autoria, { acao: 'solicitacao.recusada', entidade: 'solicitacao', entidadeId: id, funcionarioId: solicitacao.funcionario_id, depois: { resposta } });
        }
        await repo.registrarDecisao(id, status, resposta, operador.id);
    });
    return solicitacaoDe((await repositorio.buscar(id, operador.empresa_id))!);
};
