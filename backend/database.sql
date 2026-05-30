-- Criação do Banco de Dados
CREATE DATABASE IF NOT EXISTS hrflow_db;
USE hrflow_db;

-- 1. Tabela Mestra: Empresas (Inquilinos do SaaS)
CREATE TABLE IF NOT EXISTS empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Usuários (Quem faz login no sistema)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('Administrador', 'RH', 'Colaborador') DEFAULT 'Colaborador',
    empresa_id INT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- 3. Tabela de Departamentos (Isolados por Empresa)
CREATE TABLE IF NOT EXISTS departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    empresa_id INT NOT NULL,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- 4. Tabela de Cargos (Isolados por Empresa)
CREATE TABLE IF NOT EXISTS cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    empresa_id INT NOT NULL,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- 5. Tabela Core: Funcionários (O coração do sistema RH)
CREATE TABLE IF NOT EXISTS funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula VARCHAR(50),
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    data_nascimento DATE,
    data_admissao DATE NOT NULL,
    tipo_contrato ENUM('CLT', 'PJ', 'Estágio') DEFAULT 'CLT',
    salario_base DECIMAL(10, 2),
    status ENUM('Ativo', 'Inativo', 'Férias') DEFAULT 'Ativo',
    cargo_id INT,
    departamento_id INT,
    empresa_id INT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE SET NULL,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE SET NULL,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- =========================================================================
-- TRIGGER (Gatilho) DE AUTOMATIZAÇÃO (BÔNUS SAAS)
-- =========================================================================
-- Este gatilho cria automaticamente departamentos e cargos básicos
-- sempre que uma NOVA EMPRESA se registrar no sistema.
-- Assim, o formulário de cadastro de funcionário nunca fica vazio no 1º login!

DELIMITER //
CREATE TRIGGER trg_apos_criar_empresa
AFTER INSERT ON empresas
FOR EACH ROW
BEGIN
    -- Inserir Departamentos Padrão
    INSERT INTO departamentos (nome, empresa_id) VALUES 
    ('Tecnologia da Informação (TI)', NEW.id),
    ('Recursos Humanos (RH)', NEW.id),
    ('Financeiro', NEW.id),
    ('Marketing', NEW.id);

    -- Inserir Cargos Padrão
    INSERT INTO cargos (nome, empresa_id) VALUES 
    ('Desenvolvedor(a)', NEW.id),
    ('Analista de RH', NEW.id),
    ('Gerente Financeiro', NEW.id),
    ('Assistente Administrativo', NEW.id);
END;
//
DELIMITER ;