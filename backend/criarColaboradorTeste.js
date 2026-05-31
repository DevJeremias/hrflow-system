require('dotenv').config();
const bcrypt = require('bcryptjs'); 
const db = require('./config/db');

async function criarColaborador() {
    try {
        console.log('⏳ Conectando ao banco e preparando os dados...');

        const [empresas] = await db.query('SELECT id FROM empresas LIMIT 1');
        
        if (empresas.length === 0) {
            console.log('❌ Erro: Nenhuma empresa encontrada.');
            process.exit(1);
        }
        
        const empresa_id = empresas[0].id;

        // Inserção exata: com data_admissao (obrigatório) e sem as colunas novas
        const [funcResult] = await db.query(
            `INSERT INTO funcionarios (nome, cpf, email, data_admissao, empresa_id) 
             VALUES ('João Colaborador', '12345678900', 'colaborador@hrflow.com', CURRENT_DATE, ?)`,
            [empresa_id]
        );
        
        const funcionario_id = funcResult.insertId;
        console.log(`✅ Funcionário "João Colaborador" criado com ID: ${funcionario_id}`);

        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash('123456', salt);

        await db.query(
            `INSERT INTO usuarios (id, nome, email, senha, perfil, empresa_id) 
             VALUES (?, 'João Colaborador', 'colaborador@hrflow.com', ?, 'Colaborador', ?)
             ON DUPLICATE KEY UPDATE senha = VALUES(senha)`,
            [funcionario_id, senhaHash, empresa_id] 
        );

        console.log(`✅ Usuário de login criado com sucesso!`);
        console.log(`\n--- 🔑 DADOS PARA O TESTE ---`);
        console.log(`E-mail: colaborador@hrflow.com`);
        console.log(`Senha:  123456`);
        console.log(`-----------------------------\n`);
        
        process.exit(0);
    } catch (erro) {
        console.error('❌ Erro ao criar colaborador de teste:', erro);
        process.exit(1);
    }
}

criarColaborador();