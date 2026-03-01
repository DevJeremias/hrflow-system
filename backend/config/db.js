// backend/config/db.js
const mysql = require('mysql2/promise');

// Cria o pool de conexões usando as variáveis do seu arquivo .env
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exporta o pool para ser usado no server.js e nos futuros controllers
module.exports = pool;