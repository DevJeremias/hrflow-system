// Sobe um app Express numa porta livre do loopback e o derruba ao fim do teste.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

export const subirServidor = async (app: Express): Promise<{ server: http.Server; baseUrl: string }> => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

export const pararServidor = (server: http.Server): Promise<void> =>
    new Promise((resolve) => server.close(() => resolve()));

// Limites de tentativas do login e do cadastro folgados: cada teste aperta só o que quer exercitar.
export const LIMITES_AUTH_FOLGADOS = {
    loginPorIp: { windowMs: 60_000, limit: 1000 },
    loginPorIdentidade: { windowMs: 60_000, limit: 1000 },
    registroPorIp: { windowMs: 60_000, limit: 1000 },
    registroPorIdentidade: { windowMs: 60_000, limit: 1000 },
};
