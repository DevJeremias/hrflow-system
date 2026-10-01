-- Schema efetivo do HRFlow, reconstruído do que os controllers consultam e gravam.
-- Mantém os mesmos nomes de tabelas e colunas que o código usa; as divergências entre o
-- antigo database.sql e o schema do README foram resolvidas a favor do código.
-- Uma empresa com dados não pode ser apagada por um único DELETE (as chaves para empresas
-- não têm CASCADE); apagar um funcionário leva junto o login e os pontos dele.

CREATE TABLE empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    sigla VARCHAR(10) NOT NULL,
    descricao TEXT NULL,
    gestor VARCHAR(100) NULL,
    empresa_id INT NOT NULL,
    CONSTRAINT fk_departamentos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

CREATE TABLE cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    departamento_id INT NULL,
    nivel VARCHAR(50) NULL,
    salario_base DECIMAL(10, 2) NULL,
    empresa_id INT NOT NULL,
    CONSTRAINT fk_cargos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_cargos_departamento FOREIGN KEY (departamento_id) REFERENCES departamentos (id)
);

CREATE TABLE funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(20) NULL,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NULL,
    data_nascimento DATE NULL,
    data_admissao DATE NULL,
    endereco TEXT NULL,
    banco VARCHAR(100) NULL,
    agencia VARCHAR(20) NULL,
    conta VARCHAR(20) NULL,
    tipo_conta VARCHAR(50) NULL,
    nivel VARCHAR(50) NULL,
    tipo_contrato VARCHAR(50) NULL,
    salario_base DECIMAL(10, 2) NULL,
    cargo_id INT NULL,
    departamento_id INT NULL,
    status ENUM('Ativo', 'Inativo', 'Férias') NOT NULL DEFAULT 'Ativo',
    avatar MEDIUMTEXT NULL,
    empresa_id INT NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_funcionarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_funcionarios_cargo FOREIGN KEY (cargo_id) REFERENCES cargos (id),
    CONSTRAINT fk_funcionarios_departamento FOREIGN KEY (departamento_id) REFERENCES departamentos (id)
);

-- usuarios.id e funcionarios.id são sequências independentes: o vínculo é funcionario_id.
-- Administrador não tem funcionário, por isso funcionario_id é opcional.
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('Administrador', 'RH', 'Colaborador') NOT NULL DEFAULT 'Colaborador',
    empresa_id INT NOT NULL,
    funcionario_id INT NULL,
    avatar MEDIUMTEXT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_usuarios_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id) ON DELETE CASCADE
);

CREATE TABLE registro_pontos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    funcionario_id INT NOT NULL,
    empresa_id INT NOT NULL,
    tipo_registro ENUM('Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída') NOT NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    data_hora_oficial TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observacao VARCHAR(255) NULL,
    CONSTRAINT fk_registro_pontos_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_registro_pontos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);
