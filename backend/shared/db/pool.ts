import mysql from 'mysql2/promise';

// Limites do pool definidos pela aplicação. Com queueLimit 0 a fila de espera por conexão é
// ilimitada: sob carga, as requisições se acumulam até esgotar a memória. Com a fila cheia o
// mysql2 recusa a requisição na hora, e shared/utils/erros.ts a transforma em 503.
export const LIMITES_POOL = {
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 10000, // ms para abrir uma conexão nova
    maxExecutionTime: 15000, // ms que um SELECT pode rodar (max_execution_time do MySQL 8)
};

export const criarPool = (limites: Partial<typeof LIMITES_POOL> = {}) => {
    const { maxExecutionTime, ...limitesDoPool } = { ...LIMITES_POOL, ...limites };

    // Cria o pool de conexões usando as variáveis do seu arquivo .env
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        waitForConnections: true,
        ...limitesDoPool
    });

    // O comando entra na fila da conexão nova antes de qualquer consulta da aplicação.
    pool.pool.on('connection', (conexao) => {
        conexao.query(`SET SESSION max_execution_time = ${Number(maxExecutionTime)}`, (erro) => {
            if (erro) console.error('Não foi possível limitar a duração das consultas:', erro.message);
        });
    });

    return pool;
};

// O pool único da aplicação, usado pelos repositórios dos módulos.
const pool = criarPool();
export default pool;
