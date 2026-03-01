require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');

// Importação das Rotas
const authRoutes = require('./routes/authRoutes');
const funcionarioRoutes = require('./routes/funcionarioRoutes');

// Importação do Middleware de Proteção
const authMiddleware = require('./middlewares/authMiddleware');

const app = express();

// Middlewares Globais
app.use(cors());
app.use(express.json());

// Rota de Teste de Conexão com Banco
db.query('SELECT 1 + 1 AS result')
    .then(() => console.log('✅ Banco de Dados: Conexão testada e funcionando!'))
    .catch(err => console.error('❌ Erro real na conexão:', err.message));

// --- DEFINIÇÃO DAS ROTAS ---

// Rotas Públicas (Login e Registro inicial)
app.use('/api/auth', authRoutes);

// Rotas Protegidas (Exigem Token JWT)
// Aqui o authMiddleware verifica o "crachá" antes de liberar o acesso
app.use('/api/funcionarios', authMiddleware, funcionarioRoutes);

// Rota padrão da API
app.get('/api', (req, res) => {
    res.json({ mensagem: 'API do HRFlow está online e protegida! 🚀' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});