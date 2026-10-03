-- Dados legais da empresa, usados no cabeçalho do holerite (razão social e CNPJ) e nas regras de
-- folha por regime tributário. Empresas existentes ficam com tudo vazio: quem preenche é o
-- Administrador na tela de dados da empresa.
-- cnpj guarda só os 14 dígitos; a unicidade impede duas empresas do sistema com o mesmo CNPJ
-- (NULL se repete à vontade). fuso é o fuso IANA da empresa, ainda não lido pelo ponto.

ALTER TABLE empresas
    ADD COLUMN cnpj CHAR(14) NULL,
    ADD COLUMN razao_social VARCHAR(255) NULL,
    ADD COLUMN regime_tributario ENUM('Simples Nacional', 'Lucro Presumido', 'Lucro Real') NULL,
    ADD COLUMN fuso VARCHAR(64) NOT NULL DEFAULT 'America/Belem',
    ADD CONSTRAINT uq_empresas_cnpj UNIQUE (cnpj),
    ADD CONSTRAINT ck_empresas_cnpj CHECK (cnpj IS NULL OR cnpj REGEXP '^[0-9]{14}$');
