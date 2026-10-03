-- B-25: "esqueci a senha" por e-mail. O link leva um token aleatório de uso único e validade de 1 hora;
-- o banco guarda só o hash SHA-256 dele, então um vazamento da tabela não entrega links válidos.
-- usado_em marca o consumo (nunca se apaga o registro: ele é a trilha de quem redefiniu e quando).
-- Apagar a conta apaga os pedidos dela.

CREATE TABLE redefinicoes_de_senha (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expira_em TIMESTAMP NOT NULL,
    usado_em TIMESTAMP NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_redefinicoes_de_senha_token UNIQUE (token_hash),
    CONSTRAINT fk_redefinicoes_de_senha_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE INDEX idx_redefinicoes_de_senha_usuario ON redefinicoes_de_senha (usuario_id, usado_em);
