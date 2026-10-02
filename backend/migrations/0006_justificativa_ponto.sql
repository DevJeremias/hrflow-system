-- BIZ-02: a justificativa de ponto passa a ser persistida. Uma por colaborador e por dia de
-- Belém (reenviar atualiza o texto). funcionarios ganha a chave (id, empresa_id) para a chave
-- estrangeira composta: o banco recusa uma justificativa cuja empresa não seja a do colaborador.
ALTER TABLE funcionarios ADD CONSTRAINT uq_funcionarios_id_empresa UNIQUE (id, empresa_id);

CREATE TABLE justificativas_ponto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    data_referencia DATE NOT NULL,
    texto VARCHAR(1000) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_justificativas_ponto_dia UNIQUE (funcionario_id, data_referencia),
    CONSTRAINT fk_justificativas_ponto_funcionario_empresa
        FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE CASCADE,
    CONSTRAINT fk_justificativas_ponto_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

CREATE INDEX idx_justificativas_ponto_empresa_data ON justificativas_ponto (empresa_id, data_referencia);
