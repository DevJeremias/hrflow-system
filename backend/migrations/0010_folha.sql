-- Folha persistida por competência (mês de referência, 'AAAA-MM'). Uma folha por empresa e mês:
-- aberta, ela pode ser reprocessada; fechada, nada nela muda mais. Por isso tudo o que o holerite
-- mostra é copiado para cá no processamento (nome, cargo, setor, contrato, razão social, CNPJ):
-- editar o colaborador ou a empresa depois não reescreve meses fechados.
-- As chaves compostas com empresa_id seguem o padrão de 0003 e 0007 e impedem, no banco, um item
-- de uma empresa pendurado na folha de outra.
-- folha_itens.funcionario_id é RESTRICT: quem tem holerite emitido não é apagado, é inativado.

CREATE TABLE folhas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    competencia CHAR(7) NOT NULL,
    status ENUM('aberta', 'fechada') NOT NULL DEFAULT 'aberta',
    razao_social VARCHAR(255) NULL,
    cnpj CHAR(14) NULL,
    -- Colaboradores que ficaram de fora do último processamento e por quê: [{funcionarioId, nome, motivo}].
    pendencias JSON NOT NULL,
    processada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fechada_em TIMESTAMP NULL,
    fechada_por INT NULL,
    CONSTRAINT uq_folhas_empresa_competencia UNIQUE (empresa_id, competencia),
    CONSTRAINT uq_folhas_id_empresa UNIQUE (id, empresa_id),
    CONSTRAINT fk_folhas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_folhas_fechada_por FOREIGN KEY (fechada_por) REFERENCES usuarios (id) ON DELETE SET NULL,
    CONSTRAINT ck_folhas_competencia CHECK (competencia REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT ck_folhas_fechamento CHECK ((status = 'fechada') = (fechada_em IS NOT NULL))
);

CREATE TABLE folha_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folha_id INT NOT NULL,
    empresa_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cargo VARCHAR(255) NULL,
    departamento VARCHAR(255) NULL,
    tipo_contrato VARCHAR(50) NULL,
    bruto DECIMAL(10, 2) NOT NULL,
    inss DECIMAL(10, 2) NOT NULL,
    liquido DECIMAL(10, 2) NOT NULL,
    encargos DECIMAL(10, 2) NOT NULL,
    -- Linhas do holerite: [{codigo, descricao, tipo: 'provento' | 'desconto', valor}], valores em reais.
    rubricas JSON NOT NULL,
    CONSTRAINT uq_folha_itens_folha_funcionario UNIQUE (folha_id, funcionario_id),
    CONSTRAINT fk_folha_itens_folha FOREIGN KEY (folha_id, empresa_id) REFERENCES folhas (id, empresa_id) ON DELETE CASCADE,
    CONSTRAINT fk_folha_itens_funcionario FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id)
);
