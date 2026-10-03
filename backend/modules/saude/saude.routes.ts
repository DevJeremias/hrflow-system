import express from 'express';

// Prazo do SELECT 1: um monitor precisa de resposta rápida, mesmo com o banco parado ou travado.
export const PRAZO_PRONTIDAO_MS = 2000;

// /health diz se o processo da API responde e nunca toca o banco; /ready diz se ele consegue atender,
// o que inclui o banco. Ficam fora do authMiddleware porque quem pergunta é um monitor, sem sessão.
// APP_VERSION é o SHA da imagem em execução (o compose de produção o define): o deploy por pull da máquina e o
// workflow de publicação perguntam a /health qual versão está no ar. Sem a variável (desenvolvimento) o campo some.
export const criarRouter = (
    pool: { query: (sql: string) => unknown },
    { prazoMs = PRAZO_PRONTIDAO_MS, versao = process.env.APP_VERSION } = {},
) => {
    const router = express.Router();

    router.get('/health', (req, res) => {
        res.json(versao ? { status: 'ok', versao } : { status: 'ok' });
    });

    router.get('/ready', async (req, res) => {
        let temporizador: NodeJS.Timeout | undefined;
        const limite = new Promise<never>((_, rejeitar) => {
            temporizador = setTimeout(() => rejeitar(new Error('timeout')), prazoMs);
        });
        // A consulta que passa do prazo segue pendente: sem o catch, sua falha tardia seria rejeição não tratada.
        const consulta = Promise.resolve().then(() => pool.query('SELECT 1'));
        consulta.catch(() => {});
        try {
            await Promise.race([consulta, limite]);
            res.json({ status: 'ok' });
        } catch {
            res.status(503).json({ status: 'indisponivel' });
        } finally {
            clearTimeout(temporizador);
        }
    });

    return router;
};
