require('dotenv').config();
const express = require('express');
const compression = require('compression');
const db = require('./config/db');
const { interpretarTrustProxy } = require('./utils/trustProxy');
const tratarErros = require('./middlewares/tratarErros');

// Importação das Rotas
const saudeRoutes = require('./routes/saudeRoutes');
const authRoutes = require('./routes/authRoutes');
const { funcionariosRoutes } = require('./modules/funcionarios/index.ts');
const { pontoRoutes } = require('./modules/ponto/index.ts'); 
const { dashboardRoutes } = require('./modules/dashboard/index.ts');
const { perfilRoutes } = require('./modules/perfil/index.ts');
const { folhaRoutes } = require('./modules/folha/index.ts');
const estruturaRoutes = require('./routes/estruturaRoutes');

// Importação do Middleware de Proteção
const authMiddleware = require('./middlewares/authMiddleware');

const app = express();

// O limitador de tentativas da autenticação usa req.ip. Por padrão nenhum proxy é confiável
// e X-Forwarded-For é ignorado; atrás de um proxy reverso, defina TRUST_PROXY (ex.: 1).
app.set('trust proxy', interpretarTrustProxy(process.env.TRUST_PROXY));

app.disable('x-powered-by');

// Middlewares Globais
// Sem CORS: o front-end e a API respondem na mesma origem (o Caddy em produção, o proxy do Vite em
// desenvolvimento), então nenhuma origem externa precisa ler a API.
app.use(compression());

// Monitoramento: sem autenticação e antes dos parsers
app.use('/api', saudeRoutes.criarRouter(db));

// Autenticação vem antes do parser global: tem corpo pequeno e limite próprio (middlewares/limitesAuth.js)
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

// Os testes carregam o app sem abrir a porta nem testar o banco na partida.
if (require.main === module) {
    db.query('SELECT 1 + 1 AS result')
        .then(() => console.log('✅ Banco de Dados: Conexão testada e funcionando!'))
        .catch(err => console.error('❌ Erro real na conexão:', err.message));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;
