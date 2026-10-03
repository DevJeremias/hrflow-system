-- B-13: ciclo de vida do colaborador. Desligar passa a ser inativar com data e motivo, sem apagar o
-- histórico: as chaves de registro_pontos e justificativas_ponto deixam de ser ON DELETE CASCADE e
-- o banco recusa (RESTRICT) excluir quem tem marcação ou justificativa. O acesso criado ou
-- redefinido pelo gestor nasce com senha provisória, que o colaborador troca no primeiro acesso.
-- CHECK só é aplicado a partir do MySQL 8.0.16.

ALTER TABLE funcionarios
    ADD COLUMN data_desligamento DATE NULL AFTER status,
    ADD COLUMN motivo_desligamento VARCHAR(255) NULL AFTER data_desligamento,
    ADD CONSTRAINT ck_funcionarios_desligamento CHECK (
        status = 'Inativo' OR (data_desligamento IS NULL AND motivo_desligamento IS NULL)
    );

ALTER TABLE usuarios ADD COLUMN senha_provisoria BOOLEAN NOT NULL DEFAULT FALSE AFTER sessao_versao;

-- O MySQL não aceita derrubar e recriar uma chave de mesmo nome no mesmo ALTER.
ALTER TABLE registro_pontos DROP FOREIGN KEY fk_registro_pontos_funcionario;
ALTER TABLE registro_pontos
    ADD CONSTRAINT fk_registro_pontos_funcionario
        FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id) ON DELETE RESTRICT;

ALTER TABLE justificativas_ponto DROP FOREIGN KEY fk_justificativas_ponto_funcionario_empresa;
ALTER TABLE justificativas_ponto
    ADD CONSTRAINT fk_justificativas_ponto_funcionario_empresa
        FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE RESTRICT;
