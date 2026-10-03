// Uma linha de log por requisição, escrita quando a resposta termina: reqId, método, rota, status,
// duração e, se a sessão foi aceita, usuarioId e empresaId. Nunca o corpo, os cabeçalhos nem a query
// string: o cookie da sessão e os dados do formulário não vão para o log.
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from './logger.ts';

export const CABECALHO_REQ_ID = 'X-Request-Id';

// O Caddy manda o id da requisição; qualquer outro valor (vazio, longo, com caracteres de controle)
// é descartado e a API gera o seu.
const ID_ACEITO = /^[A-Za-z0-9._-]{8,64}$/;

// Rota do Express com os parâmetros por nome (/api/funcionarios/:id), que agrupa as linhas; sem rota
// casada (404), o caminho sem a query string.
const rotaDe = (req: Request): string =>
    req.route ? `${req.baseUrl}${String(req.route.path)}` : req.originalUrl.split('?')[0];

export const criarRegistroDeRequisicoes = (logger: Logger) => {
    const campos = (entrada: IncomingMessage, res: ServerResponse, duracaoMs: number) => {
        const req = entrada as Request;
        return {
            metodo: req.method,
            rota: rotaDe(req),
            status: res.statusCode,
            duracaoMs,
            usuarioId: req.usuario?.id,
            empresaId: req.usuario?.empresa_id,
        };
    };

    return pinoHttp({
        logger,
        // Só o reqId fica preso ao logger da requisição (req.log) e ao da resposta: sem isto o pino-http anexaria
        // a requisição inteira (cookies incluídos) a cada linha. O resto vai no objeto final.
        quietReqLogger: true,
        quietResLogger: true,
        wrapSerializers: false,
        genReqId: (req, res) => {
            const recebido = req.headers['x-request-id'];
            const id = typeof recebido === 'string' && ID_ACEITO.test(recebido) ? recebido : randomUUID();
            res.setHeader(CABECALHO_REQ_ID, id);
            return id;
        },
        customLogLevel: (_req, res, erro) => (erro || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
        // O erro em si é registrado onde ocorre (responderErro), com o mesmo reqId; aqui só o resumo.
        customSuccessObject: (req, res, val) => campos(req, res, val.responseTime),
        customErrorObject: (req, res, _erro, val) => campos(req, res, val.responseTime),
        customSuccessMessage: () => 'requisição concluída',
        customErrorMessage: () => 'requisição falhou',
    });
};
