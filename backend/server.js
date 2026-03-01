// 1. Importações e Configurações iniciais
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db'); // <--- ESSA LINHA É O QUE ESTÁ FALTANDO!

const app = express();

// 2. Middlewares
app.use(cors());
app.use(express.json());

// 3. Teste de conexão (A linha 12 que deu erro)
db.query('SELECT 1 + 1 AS result')
    .then(() => {
        console.log('✅ Banco de Dados: Conexão testada e funcionando!');
    })
    .catch(err => {
        console.error('❌ Erro real na conexão:', err.message);
    });

// 4. Rotas
app.get('/api', (req, res) => {
    res.json({ mensagem: 'API do HRFlow está online! 🚀' });
});

// 5. Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});