-- B-25: avisos dentro do sistema (o sino do cabeçalho). Cada linha é um aviso para um usuário: o
-- holerite que ficou disponível, a decisão de uma justificativa. `lida_em` nulo é "não lida".
-- tipo é texto livre no banco (a lista fica no código, modules/notificacoes) para um novo aviso não
-- exigir migration. Apagar a conta apaga os avisos dela; empresa_id repete o da conta para a
-- consulta nunca cruzar empresas, no padrão de 0003 e 0007.

CREATE TABLE notificacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    titulo VARCHAR(120) NOT NULL,
    mensagem VARCHAR(500) NOT NULL,
    -- Caminho do front-end que o aviso abre ('/meu-painel/holerites').
    link VARCHAR(255) NULL,
    lida_em TIMESTAMP NULL,
    criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notificacoes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_notificacoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- A lista do sino (mais recentes primeiro) e a contagem de não lidas partem do usuário.
CREATE INDEX idx_notificacoes_usuario ON notificacoes (usuario_id, lida_em, id);
