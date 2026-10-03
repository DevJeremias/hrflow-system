// Ponto de entrada do Node.js. O app fica em app.ts: os testes o carregam sem abrir a porta nem
// testar o banco na partida.
// O dotenv vem primeiro: o pool e o segredo JWT leem o ambiente ao serem carregados.
import 'dotenv/config';
import db from './shared/db/pool.ts';
import { app } from './app.ts';

db.query('SELECT 1 + 1 AS result')
    .then(() => console.log('✅ Banco de Dados: Conexão testada e funcionando!'))
    .catch((err: Error) => console.error('❌ Erro real na conexão:', err.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
