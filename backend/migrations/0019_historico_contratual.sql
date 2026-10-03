-- B-22: histórico contratual. Cada linha é um período em que o colaborador teve o mesmo salário, cargo e
-- departamento; a que está em vigor tem vigencia_fim NULL. Mudar qualquer um dos três fecha a linha
-- aberta e abre outra (no mesmo dia, a linha aberta é corrigida no lugar). Cargo e departamento ficam
-- também pelo nome da época: renomear ou apagar o cargo depois não reescreve o passado.
-- Apagar o cadastro de quem nunca teve movimento leva o histórico junto.
CREATE TABLE historico_contratual (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    salario_base DECIMAL(10, 2) NULL,
    cargo_id INT NULL,
    cargo VARCHAR(255) NULL,
    departamento_id INT NULL,
    departamento VARCHAR(255) NULL,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE NULL,
    registrado_por INT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historico_contratual_funcionario
        FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE CASCADE,
    CONSTRAINT fk_historico_contratual_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
    CONSTRAINT ck_historico_contratual_vigencia CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
    INDEX idx_historico_contratual_funcionario (funcionario_id, vigencia_inicio)
);

-- Quem já existe entra com a situação de hoje, vigente desde a admissão (ou, sem ela, desde o cadastro).
INSERT INTO historico_contratual (empresa_id, funcionario_id, salario_base, cargo_id, cargo, departamento_id, departamento, vigencia_inicio)
SELECT f.empresa_id, f.id, f.salario_base, f.cargo_id, c.nome, f.departamento_id, d.nome, COALESCE(f.data_admissao, DATE(f.criado_em))
FROM funcionarios f
LEFT JOIN cargos c ON c.id = f.cargo_id
LEFT JOIN departamentos d ON d.id = f.departamento_id;
