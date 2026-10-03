import mysql from 'mysql2/promise';

// Limites do pool definidos pela aplicação. Com queueLimit 0 a fila de espera por conexão é
// ilimitada: sob carga, as requisições se acumulam até esgotar a memória. Com a fila cheia o
// mysql2 recusa a requisição na hora, e shared/utils/erros.ts a transforma em 503.
// connectionLimit e queueLimit podem ser trocados por DB_CONNECTION_LIMIT e DB_QUEUE_LIMIT (validadas em
// shared/config/ambiente.ts), para dimensionar o pool sem mexer no código e para o teste de carga reduzi-los.
const inteiroDoAmbiente = (valor: string | undefined, padrao: number) => {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : padrao;
};

export const LIMITES_POOL = {
    connectionLimit: inteiroDoAmbiente(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: inteiroDoAmbiente(process.env.DB_QUEUE_LIMIT, 50),
    // Banco fora do ar vira 503 em poucos segundos: o login não pode esperar 10 s por uma conexão que não vem.
    connectTimeout: 5000, // ms para abrir uma conexão nova
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
        // DATE chega como 'AAAA-MM-DD'. Como Date, o driver o interpreta no fuso do processo e a data
        // pode virar o dia anterior ao ser serializada em UTC.
        dateStrings: ['DATE'],
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
