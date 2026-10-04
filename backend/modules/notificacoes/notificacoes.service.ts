// Regras das notificações: o que o sino mostra e como os outros módulos avisam alguém. Não conhece
// HTTP (falhas de regra saem como ErroDeNotificacao) e só chega ao banco pelo repositório.
import logger from '../../shared/observabilidade/logger.ts';
import { emailConfigurado, enviarEmailSemFalhar, linkDoApp } from '../../shared/email/email.ts';
import { emailDeNotificacao } from '../../shared/email/modelos.ts';
import * as repositorio from './notificacoes.repository.ts';
import { ErroDeNotificacao } from './notificacoes.erros.ts';

// Os avisos que o sistema gera. O banco guarda texto livre, mas só estes saem do código.
export type TipoDeNotificacao = 'holerite' | 'justificativa' | 'ausencia';

export interface NovaNotificacao {
    tipo: TipoDeNotificacao;
    titulo: string;
    mensagem: string;
    // Caminho do front-end que o aviso abre, ou null.
    link: string | null;
}

// Formato que o front-end consome (frontend/src/services/notificacoesService.ts).
export interface Notificacao {
    id: number;
    tipo: string;
    titulo: string;
    mensagem: string;
    link: string | null;
    lida: boolean;
    criadaEm: string;
}

export interface ListaDeNotificacoes {
    naoLidas: number;
    itens: Notificacao[];
}

const TITULO_MAXIMO = 120;
const MENSAGEM_MAXIMA = 500;

const cortar = (texto: string, maximo: number): string => (texto.length <= maximo ? texto : `${texto.slice(0, maximo - 1)}…`);

export const listarNotificacoes = async ({ usuarioId, empresaId, limite }: { usuarioId: number; empresaId: number; limite: number }): Promise<ListaDeNotificacoes> => {
    const [linhas, naoLidas] = await Promise.all([
        repositorio.listar(usuarioId, empresaId, limite),
        repositorio.contarNaoLidas(usuarioId, empresaId),
    ]);
    return {
        naoLidas,
        itens: linhas.map(({ criada, lida, ...n }) => ({ ...n, lida: Boolean(lida), criadaEm: new Date(criada * 1000).toISOString() })),
    };
};

export const marcarComoLida = async ({ id, usuarioId, empresaId }: { id: number; usuarioId: number; empresaId: number }): Promise<{ naoLidas: number }> => {
    if (!await repositorio.marcarLida(id, usuarioId, empresaId)) throw new ErroDeNotificacao('inexistente', 'Notificação não encontrada.');
    return { naoLidas: await repositorio.contarNaoLidas(usuarioId, empresaId) };
};

export const marcarTodasComoLidas = async ({ usuarioId, empresaId }: { usuarioId: number; empresaId: number }): Promise<{ naoLidas: number }> => {
    await repositorio.marcarTodasLidas(usuarioId, empresaId);
    return { naoLidas: 0 };
};

// Avisa as contas de acesso destes colaboradores: grava a notificação e, com o e-mail configurado,
// o envia também (em segundo plano, sem segurar quem chamou). É um complemento do que o usuário acabou
// de fazer (fechar a folha, decidir uma justificativa) e nunca o desfaz: uma falha só entra no log.
export const notificarColaboradores = async (empresaId: number, funcionarioIds: number[], notificacao: NovaNotificacao): Promise<void> => {
    try {
        const aviso = { ...notificacao, titulo: cortar(notificacao.titulo, TITULO_MAXIMO), mensagem: cortar(notificacao.mensagem, MENSAGEM_MAXIMA) };
        const destinatarios = await repositorio.destinatariosDosColaboradores(empresaId, funcionarioIds);
        await repositorio.inserir(empresaId, destinatarios.map((d) => d.id), aviso);

        if (emailConfigurado()) {
            const link = aviso.link === null ? null : linkDoApp(aviso.link);
            void (async () => {
                for (const { nome, email } of destinatarios) {
                    await enviarEmailSemFalhar(emailDeNotificacao({ nome, email }, { titulo: aviso.titulo, mensagem: aviso.mensagem, link }));
                }
            })();
        }
    } catch (erro) {
        logger.error({ err: erro, tipo: notificacao.tipo, empresaId }, 'Não foi possível gerar a notificação');
    }
};
