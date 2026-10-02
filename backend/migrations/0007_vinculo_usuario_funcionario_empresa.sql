-- O vínculo deve apontar para funcionário da mesma empresa do usuário.
ALTER TABLE usuarios
    DROP FOREIGN KEY fk_usuarios_funcionario,
    ADD CONSTRAINT fk_usuarios_funcionario_empresa
        FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE CASCADE;
