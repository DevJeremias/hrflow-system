// Ponto de entrada do Node.js. O app fica em app.ts: os testes o carregam sem abrir a porta nem
// testar o banco na partida.
// O dotenv vem primeiro: o pool e o segredo JWT leem o ambiente ao serem carregados.
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import db from './shared/db/pool.ts';
import { lerAmbiente } from './shared/config/ambiente.ts';
import logger from './shared/observabilidade/logger.ts';
import { criarEncerramento } from './shared/observabilidade/encerramento.ts';
import { configurarEmail, transporteDeLog } from './shared/email/email.ts';
import { criarTransporteSes } from './shared/email/ses.ts';
import { descarregarSentry, iniciarSentry, registrarNoSentry } from './shared/observabilidade/sentry.ts';

// Falha antes de a porta abrir: não há o que encerrar com calma, o processo só sai com o motivo no log.
const abortar = async (erro: unknown, mensagem: string): Promise<never> => {
    logger.fatal({ err: erro }, mensagem);
    registrarNoSentry(erro);
    await descarregarSentry().catch(() => {});
    process.exit(1);
};

let encerrar: ReturnType<typeof criarEncerramento> | null = null;

// Depois da partida, uma falha que ninguém tratou deixa o processo em estado desconhecido: o encerramento
// ordenado deixa as requisições em andamento terminarem e o orquestrador sobe outra instância.
const falhaInesperada = (mensagem: string) => (erro: unknown) => {
    logger.fatal({ err: erro }, mensagem);
    registrarNoSentry(erro);
    return encerrar ? encerrar('falha inesperada', 1) : abortar(erro, mensagem);
};
process.on('unhandledRejection', falhaInesperada('Promise rejeitada sem tratamento'));
process.on('uncaughtException', falhaInesperada('Exceção sem tratamento'));

try {
    const { porta, sentryDsn, email } = lerAmbiente();
    await iniciarSentry(sentryDsn);
    if (email) {
        configurarEmail({ transporte: email.transporte === 'ses' ? criarTransporteSes() : transporteDeLog, remetente: email.remetente, urlDoApp: email.urlDoApp });
    }

    // O app (e com ele o segredo JWT) só é carregado depois de o ambiente ser conferido.
    const { criarApp } = await import('./app.ts');

    db.query('SELECT 1 + 1 AS result')
        .then(() => logger.info('Banco de Dados: Conexão testada e funcionando!'))
        .catch((err: Error) => logger.error({ err }, 'Banco de dados: a conexão de teste falhou'));

    const server = criarApp().listen(porta, (erro?: Error) => {
        // Express 5 entrega ao callback o erro de abrir a porta (EADDRINUSE, EACCES).
        if (erro) return void abortar(erro, `Não foi possível abrir a porta ${porta}`);
        // PORT=0 deixa o sistema escolher a porta: o log diz qual foi.
        const { port } = server.address() as AddressInfo;
        logger.info({ porta: port }, `Servidor rodando na porta ${port}`);
    });

    encerrar = criarEncerramento({ server, pool: db, logger, aoFinal: descarregarSentry });
    for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => void encerrar?.(sinal));
} catch (erro) {
    await abortar(erro, 'A API não pôde subir');
}
