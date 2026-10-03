import express from 'express';
import compression from 'compression';
import db from './shared/db/pool.ts';
import { interpretarTrustProxy } from './shared/config/trustProxy.ts';
import tratarErros from './shared/middlewares/tratarErros.ts';
import appLogger from './shared/observabilidade/logger.ts';
import type { Logger } from './shared/observabilidade/logger.ts';
import { criarRegistroDeRequisicoes } from './shared/observabilidade/registroDeRequisicoes.ts';

// Importação das Rotas
import { criarSaudeRouter } from './modules/saude/index.ts';
import { authRoutes } from './modules/auth/index.ts';
import { funcionariosRoutes } from './modules/funcionarios/index.ts';
import { pontoRoutes } from './modules/ponto/index.ts';
import { dashboardRoutes } from './modules/dashboard/index.ts';
import { perfilRoutes } from './modules/perfil/index.ts';
import { estruturaRoutes } from './modules/estrutura/index.ts';
import { folhaRoutes } from './modules/folha/index.ts';

// Importação do Middleware de Proteção
import authMiddleware from './shared/middlewares/authMiddleware.ts';

// O logger é parâmetro para os testes lerem o que o app escreve; em produção é o logger da API.
export const criarApp = ({ logger = appLogger }: { logger?: Logger } = {}) => {
    const app = express();

    // O primeiro middleware: dá o id à requisição (X-Request-Id) e escreve a linha de log quando a resposta termina.
    app.use(criarRegistroDeRequisicoes(logger));

    // O limitador de tentativas da autenticação usa req.ip. Por padrão nenhum proxy é confiável
    // e X-Forwarded-For é ignorado; atrás de um proxy reverso, defina TRUST_PROXY (ex.: 1).
    app.set('trust proxy', interpretarTrustProxy(process.env.TRUST_PROXY));

    app.disable('x-powered-by');

    // Middlewares Globais
    // Sem CORS: o front-end e a API respondem na mesma origem (o Caddy em produção, o proxy do Vite em
    // desenvolvimento), então nenhuma origem externa precisa ler a API.
    app.use(compression());

    // Monitoramento: sem autenticação e antes dos parsers
    app.use('/api', criarSaudeRouter(db));

    // Autenticação vem antes do parser global: tem corpo pequeno e limite próprio (shared/middlewares/limitesAuth.ts)
    app.use('/api/auth', authRoutes);

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

export const app = criarApp();
