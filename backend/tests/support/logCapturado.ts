// Logger do pino que escreve numa lista em vez de stdout: o teste lê as linhas JSON como o Docker as leria.
import { Writable } from 'node:stream';
import { criarLogger } from '../../shared/observabilidade/logger.ts';

export const criarLoggerCapturado = () => {
    const linhas: Record<string, unknown>[] = [];
    const destino = new Writable({
        write(pedaco, _codificacao, pronto) {
            for (const linha of String(pedaco).split('\n').filter(Boolean)) linhas.push(JSON.parse(linha));
            pronto();
        },
    });
    return { logger: criarLogger(destino, 'info'), linhas };
};
