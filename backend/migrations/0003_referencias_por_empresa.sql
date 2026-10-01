-- DATA-01 / SEC-05: o banco passa a recusar cargo e departamento de outra empresa.
-- Chave única (id, empresa_id) nas tabelas referenciadas e chaves estrangeiras compostas
-- no lugar das simples. NULL continua permitido: colaborador sem cargo ou sem departamento.
-- Antes de aplicar, 0003_referencias_por_empresa.audit.sql procura linhas que violariam.

ALTER TABLE departamentos ADD CONSTRAINT uq_departamentos_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE cargos ADD CONSTRAINT uq_cargos_id_empresa UNIQUE (id, empresa_id);

ALTER TABLE cargos DROP FOREIGN KEY fk_cargos_departamento;
ALTER TABLE cargos ADD CONSTRAINT fk_cargos_departamento_empresa
    FOREIGN KEY (departamento_id, empresa_id) REFERENCES departamentos (id, empresa_id);

ALTER TABLE funcionarios DROP FOREIGN KEY fk_funcionarios_cargo;
ALTER TABLE funcionarios DROP FOREIGN KEY fk_funcionarios_departamento;
ALTER TABLE funcionarios ADD CONSTRAINT fk_funcionarios_cargo_empresa
    FOREIGN KEY (cargo_id, empresa_id) REFERENCES cargos (id, empresa_id);
ALTER TABLE funcionarios ADD CONSTRAINT fk_funcionarios_departamento_empresa
    FOREIGN KEY (departamento_id, empresa_id) REFERENCES departamentos (id, empresa_id);
