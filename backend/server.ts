// Ponto de entrada do Node.js. O app fica em app.ts: os testes o carregam sem abrir a porta nem
// testar o banco na partida.
// O dotenv vem primeiro: o pool e o segredo JWT leem o ambiente ao serem carregados.
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import db from './shared/db/pool.ts';
import { criarApp } from './app.ts';

db.query('SELECT 1 + 1 AS result')
    .then(() => console.log('✅ Banco de Dados: Conexão testada e funcionando!'))
    .catch((err: Error) => console.error('❌ Erro real na conexão:', err.message));

const servidor = criarApp().listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Servidor rodando na porta ${(servidor.address() as AddressInfo).port}`);
});

// O orquestrador (Docker, Portainer) pede o fim com SIGTERM: para de aceitar conexões, solta as
// ociosas e fecha o pool, em vez de cortar requisições em andamento.
const encerrar = () => {
    servidor.close(() => db.end().finally(() => process.exit(0)));
    servidor.closeIdleConnections();
};
process.once('SIGTERM', encerrar);
process.once('SIGINT', encerrar);
