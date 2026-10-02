require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const { interpretarTrustProxy } = require('./utils/trustProxy');
const tratarErros = require('./middlewares/tratarErros');

// Importação das Rotas
const authRoutes = require('./routes/authRoutes');
const funcionarioRoutes = require('./routes/funcionarioRoutes');
const pontoRoutes = require('./routes/pontoRoutes'); 
const estruturaRoutes = require('./routes/estruturaRoutes');
const folhaRoutes = require('./routes/folhaRoutes');
const perfilRoutes = require('./routes/perfilRoutes');

// Importação do Middleware de Proteção
const authMiddleware = require('./middlewares/authMiddleware');

const app = express();

// O limitador de tentativas da autenticação usa req.ip. Por padrão nenhum proxy é confiável
// e X-Forwarded-For é ignorado; atrás de um proxy reverso, defina TRUST_PROXY (ex.: 1).
app.set('trust proxy', interpretarTrustProxy(process.env.TRUST_PROXY));

// Middlewares Globais
app.use(cors({ exposedHeaders: ['X-Total-Count'] }));

// Autenticação vem antes do parser global: tem corpo pequeno e limite próprio (middlewares/limitesAuth.js)
app.use('/api/auth', authRoutes);

// O maior corpo legítimo é o avatar em base64: 2 MB de imagem viram cerca de 2,7 MB de texto (utils/validacaoAvatar.js)
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ limit: '4mb', extended: true }));

// Rota de Teste de Conexão com Banco
db.query('SELECT 1 + 1 AS result')
    .then(() => console.log('✅ Banco de Dados: Conexão testada e funcionando!'))
    .catch(err => console.error('❌ Erro real na conexão:', err.message));

// --- DEFINIÇÃO DAS ROTAS ---

// Rotas Protegidas (Exigem Token JWT)
app.use('/api/funcionarios', authMiddleware, funcionarioRoutes);
app.use('/api/ponto', authMiddleware, pontoRoutes); 
app.use('/api/estrutura', authMiddleware, estruturaRoutes); 
app.use('/api/folha', authMiddleware, folhaRoutes); 
app.use('/api/perfil', authMiddleware, perfilRoutes); 

// Rota padrão da API
app.get('/api', (req, res) => {
    res.json({ mensagem: 'API do HRFlow está online e protegida! 🚀' });
});

// Precisa vir depois de todas as rotas: devolve JSON para os erros dos parsers e dos controllers
app.use(tratarErros);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});