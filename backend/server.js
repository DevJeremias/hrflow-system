require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');

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

// Middlewares Globais
app.use(cors());

// CORREÇÃO CRÍTICA AQUI: Aumentando o limite para suportar imagens Base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rota de Teste de Conexão com Banco
db.query('SELECT 1 + 1 AS result')
    .then(() => console.log('✅ Banco de Dados: Conexão testada e funcionando!'))
    .catch(err => console.error('❌ Erro real na conexão:', err.message));

// --- DEFINIÇÃO DAS ROTAS ---

// Rotas Públicas (Login e Registro inicial)
app.use('/api/auth', authRoutes);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});