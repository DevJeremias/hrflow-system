import express from 'express';
import compression from 'compression';
import pool from './shared/db/pool.ts';
import { interpretarTrustProxy } from './shared/config/trustProxy.ts';
import tratarErros from './shared/middlewares/tratarErros.ts';

// Importação das Rotas
import { criarSaudeRouter } from './modules/saude/index.ts';
import { criarAuthRouter } from './modules/auth/index.ts';
import { funcionariosRoutes } from './modules/funcionarios/index.ts';
import { pontoRoutes } from './modules/ponto/index.ts';
import { dashboardRoutes } from './modules/dashboard/index.ts';
import { perfilRoutes } from './modules/perfil/index.ts';
import { estruturaRoutes } from './modules/estrutura/index.ts';
import { folhaRoutes } from './modules/folha/index.ts';

// Importação do Middleware de Proteção
import authMiddleware from './shared/middlewares/authMiddleware.ts';

export interface OpcoesDoApp {
    // O banco que o /api/ready consulta. Os repositórios dos módulos usam o pool compartilhado (shared/db/pool.ts).
    db?: Parameters<typeof criarSaudeRouter>[0];
    // Limites de tentativas do login e do cadastro, para os testes apertarem só o que querem exercitar.
    limitesAuth?: Parameters<typeof criarAuthRouter>[0];
    // Mesmo formato de TRUST_PROXY (número de proxies ou sub-redes); sem ele, vale a variável de ambiente.
    trustProxy?: string;
}

// Monta o app Express inteiro, sem abrir porta: server.ts o escuta e os testes sobem o mesmo app.
export const criarApp = ({ db = pool, limitesAuth, trustProxy = process.env.TRUST_PROXY }: OpcoesDoApp = {}) => {
    const app = express();

    // O limitador de tentativas da autenticação usa req.ip. Por padrão nenhum proxy é confiável
    // e X-Forwarded-For é ignorado; atrás de um proxy reverso, defina TRUST_PROXY (ex.: 1).
    app.set('trust proxy', interpretarTrustProxy(trustProxy));

    app.disable('x-powered-by');

    // Middlewares Globais
    // Sem CORS: o front-end e a API respondem na mesma origem (o Caddy em produção, o proxy do Vite em
    // desenvolvimento), então nenhuma origem externa precisa ler a API.
    app.use(compression());

    // Monitoramento: sem autenticação e antes dos parsers
    app.use('/api', criarSaudeRouter(db));

    // Autenticação vem antes do parser global: tem corpo pequeno e limite próprio (shared/middlewares/limitesAuth.ts)
    app.use('/api/auth', criarAuthRouter(limitesAuth));

    // O maior corpo legítimo é o avatar em base64: 2 MB de imagem viram cerca de 2,7 MB de texto (modules/funcionarios/funcionarios.avatar.ts)
    app.use(express.json({ limit: '4mb' }));
    app.use(express.urlencoded({ limit: '4mb', extended: true }));

    // --- DEFINIÇÃO DAS ROTAS ---

    // Rotas Protegidas (Exigem Token JWT)
    app.use('/api/funcionarios', authMiddleware, funcionariosRoutes);
    app.use('/api/ponto', authMiddleware, pontoRoutes);
    app.use('/api/estrutura', authMiddleware, estruturaRoutes);
    app.use('/api/folha', authMiddleware, folhaRoutes);
    app.use('/api/perfil', authMiddleware, perfilRoutes);
    app.use('/api/dashboard', authMiddleware, dashboardRoutes);

    // Rota padrão da API
    app.get('/api', (req, res) => {
        res.json({ mensagem: 'API do HRFlow está online e protegida! 🚀' });
    });

    // Rota de API inexistente: JSON, não a página HTML padrão do Express
    app.use('/api', (req, res) => {
        res.status(404).json({ erro: 'Rota não encontrada.' });
    });

    // Precisa vir depois de todas as rotas: devolve JSON para os erros dos parsers e dos controllers
    app.use(tratarErros);

    return app;
};
