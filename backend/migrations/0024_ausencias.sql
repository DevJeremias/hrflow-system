-- B-20: férias e afastamentos. O colaborador pede, o RH decide, e o período aprovado passa a valer
-- no status do colaborador (lido de ausencias, sem gravar em funcionarios) e na folha.
-- A chave composta com empresa_id segue o padrão de 0003 e 0007: o banco recusa uma ausência cuja
-- empresa não seja a do colaborador. funcionario_id é RESTRICT: quem tem ausência registrada é
-- inativado, não apagado, como quem tem ponto (0011).
-- O anexo (atestado, boletim, comprovante) fica no banco, como o avatar: um backup cobre tudo e a
-- consulta já filtra por empresa. O limite de 5 MB e os tipos PDF, JPEG e PNG são conferidos pela API.

CREATE TABLE ausencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    tipo ENUM('Férias', 'Licença Médica', 'Licença Maternidade', 'Licença Paternidade', 'Acidente de Trabalho', 'Outros') NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    observacao VARCHAR(1000) NOT NULL,
    status ENUM('Pendente', 'Aprovada', 'Recusada') NOT NULL DEFAULT 'Pendente',
    resposta VARCHAR(500) NULL,
    decidido_por INT NULL,
    decidido_em TIMESTAMP NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_ausencias_id_empresa UNIQUE (id, empresa_id),
    CONSTRAINT fk_ausencias_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_ausencias_funcionario_empresa
        FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ausencias_decidido_por FOREIGN KEY (decidido_por) REFERENCES usuarios (id) ON DELETE SET NULL,
    CONSTRAINT ck_ausencias_periodo CHECK (data_fim >= data_inicio),
    CONSTRAINT ck_ausencias_decisao CHECK ((status = 'Pendente') = (decidido_em IS NULL))
);

CREATE INDEX idx_ausencias_empresa_status ON ausencias (empresa_id, status, criado_em);
CREATE INDEX idx_ausencias_funcionario_periodo ON ausencias (funcionario_id, status, data_inicio, data_fim);

CREATE TABLE ausencia_anexos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ausencia_id INT NOT NULL,
    empresa_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(100) NOT NULL,
    tamanho INT NOT NULL,
    conteudo MEDIUMBLOB NOT NULL,
    CONSTRAINT uq_ausencia_anexos_ausencia UNIQUE (ausencia_id),
    CONSTRAINT fk_ausencia_anexos_ausencia FOREIGN KEY (ausencia_id, empresa_id) REFERENCES ausencias (id, empresa_id) ON DELETE CASCADE
);
