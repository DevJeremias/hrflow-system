-- B-21: IRRF, FGTS, eventos de folha e dependentes.
-- Dependentes reduzem a base do IRRF (R$ 189,59 cada, na tabela vigente). Quem some com o
-- cadastro leva os dependentes junto (ON DELETE CASCADE); a folha já emitida guarda só a contagem.
-- A folha passa a copiar também o regime tributário da empresa, para que alterá-lo depois não
-- reescreva os encargos de um mês fechado, e cada item guarda IRRF, FGTS, as bases de cálculo e os
-- lançamentos (adiantamento, VT, VR, plano de saúde) que o RH informou: reprocessar a folha
-- aberta recalcula tudo, mas parte dos lançamentos de cada colaborador. Itens de folhas emitidas
-- antes desta migration ficam com IRRF e FGTS zerados e sem bases: eles foram calculados sem eles.

CREATE TABLE dependentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    parentesco ENUM('Cônjuge', 'Filho(a)', 'Pai ou mãe', 'Outro') NOT NULL,
    data_nascimento DATE NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dependentes_funcionario FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE CASCADE,
    INDEX idx_dependentes_funcionario (funcionario_id)
);

ALTER TABLE folhas
    ADD COLUMN regime_tributario ENUM('Simples Nacional', 'Lucro Presumido', 'Lucro Real') NULL AFTER cnpj;

ALTER TABLE folha_itens
    ADD COLUMN irrf DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER inss,
    ADD COLUMN fgts DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER encargos,
    ADD COLUMN dependentes TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER fgts,
    -- {inss, fgts, irrf}: as bases de cálculo, em reais. Nulo nos itens anteriores ao IRRF.
    ADD COLUMN bases JSON NULL AFTER dependentes,
    -- {adiantamento, valeTransporte, valeRefeicao, planoSaude}: o que o RH lançou, em reais.
    ADD COLUMN lancamentos JSON NULL AFTER bases;
