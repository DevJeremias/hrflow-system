const express = require('express');

// Prazo do SELECT 1: um monitor precisa de resposta rápida, mesmo com o banco parado ou travado.
const PRAZO_PRONTIDAO_MS = 2000;

// /health diz se o processo da API responde e nunca toca o banco; /ready diz se ele consegue atender,
// o que inclui o banco. Ficam fora do authMiddleware porque quem pergunta é um monitor, sem sessão.
const criarRouter = (pool, { prazoMs = PRAZO_PRONTIDAO_MS } = {}) => {
    const router = express.Router();

    router.get('/health', (req, res) => {
        res.json({ status: 'ok' });
    });

    router.get('/ready', async (req, res) => {
        let temporizador;
        const limite = new Promise((_, rejeitar) => {
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

module.exports = { criarRouter, PRAZO_PRONTIDAO_MS };
