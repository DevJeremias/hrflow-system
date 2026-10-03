-- Cadastro completo do colaborador e integridade dos dados que o identificam.
-- Documentos (rg, pis, ctps), matrícula, endereço em colunas e contato de emergência entram em
-- funcionarios; `endereco` (texto livre) fica como estava, só para leitura do que já foi digitado.
-- CPF passa a guardar só os 11 dígitos e a ser único por empresa (NULL se repete à vontade): a
-- unicidade é por empresa porque a mesma pessoa pode ser colaboradora de duas. Departamento e cargo
-- deixam de se repetir (por empresa e, no cargo, por departamento), e a sigla fica em maiúsculas.
-- Antes de aplicar, 0016_cadastro_completo.audit.sql procura linhas que violariam as chaves únicas.

UPDATE funcionarios SET cpf = REGEXP_REPLACE(cpf, '[^0-9]', '') WHERE cpf IS NOT NULL;
UPDATE funcionarios SET cpf = NULL WHERE cpf = '';

UPDATE departamentos SET nome = TRIM(nome), sigla = UPPER(TRIM(sigla));
UPDATE cargos SET nome = TRIM(nome);

ALTER TABLE funcionarios
    ADD COLUMN matricula VARCHAR(20) NULL,
    ADD COLUMN rg VARCHAR(20) NULL,
    ADD COLUMN pis CHAR(11) NULL,
    ADD COLUMN ctps VARCHAR(20) NULL,
    ADD COLUMN cep CHAR(8) NULL,
    ADD COLUMN logradouro VARCHAR(150) NULL,
    ADD COLUMN numero VARCHAR(20) NULL,
    ADD COLUMN complemento VARCHAR(100) NULL,
    ADD COLUMN bairro VARCHAR(100) NULL,
    ADD COLUMN cidade VARCHAR(100) NULL,
    ADD COLUMN uf CHAR(2) NULL,
    ADD COLUMN contato_emergencia_nome VARCHAR(100) NULL,
    ADD COLUMN contato_emergencia_telefone VARCHAR(20) NULL,
    ADD COLUMN contato_emergencia_parentesco VARCHAR(50) NULL,
    ADD CONSTRAINT uq_funcionarios_empresa_cpf UNIQUE (empresa_id, cpf),
    ADD CONSTRAINT uq_funcionarios_empresa_matricula UNIQUE (empresa_id, matricula);

ALTER TABLE departamentos ADD CONSTRAINT uq_departamentos_empresa_nome UNIQUE (empresa_id, nome);
ALTER TABLE cargos ADD CONSTRAINT uq_cargos_empresa_departamento_nome UNIQUE (empresa_id, departamento_id, nome);

-- Dependentes seguem o colaborador: apagar o cadastro leva os dependentes junto. A chave composta
-- impede um dependente apontar para colaborador de outra empresa.
CREATE TABLE dependentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    parentesco ENUM('Filho(a)', 'Cônjuge', 'Enteado(a)', 'Pai ou mãe', 'Outro') NOT NULL,
    data_nascimento DATE NOT NULL,
    cpf VARCHAR(11) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dependentes_funcionario_empresa
        FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE CASCADE,
    CONSTRAINT uq_dependentes_funcionario_cpf UNIQUE (funcionario_id, cpf),
    CONSTRAINT ck_dependentes_cpf CHECK (cpf IS NULL OR cpf REGEXP '^[0-9]{11}$')
);
