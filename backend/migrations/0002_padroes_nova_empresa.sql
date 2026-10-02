-- Toda empresa nova nasce com departamentos e cargos básicos, para que o formulário de
-- cadastro de colaborador não fique vazio no primeiro login (comportamento do antigo database.sql).
-- CREATE TRIGGER exige o privilégio TRIGGER e, com log binário ligado, SUPER ou
-- log_bin_trust_function_creators=1.
CREATE TRIGGER trg_apos_criar_empresa
AFTER INSERT ON empresas
FOR EACH ROW
BEGIN
    INSERT INTO departamentos (nome, sigla, empresa_id) VALUES
        ('Tecnologia da Informação (TI)', 'TI', NEW.id),
        ('Recursos Humanos (RH)', 'RH', NEW.id),
        ('Financeiro', 'FIN', NEW.id),
        ('Marketing', 'MKT', NEW.id);

    INSERT INTO cargos (nome, departamento_id, empresa_id)
    SELECT cargo.nome, d.id, NEW.id
    FROM (
        SELECT 'Desenvolvedor(a)' AS nome, 'TI' AS sigla
        UNION ALL SELECT 'Analista de RH', 'RH'
        UNION ALL SELECT 'Gerente Financeiro', 'FIN'
        UNION ALL SELECT 'Assistente Administrativo', 'FIN'
    ) AS cargo
    JOIN departamentos d ON d.sigla = cargo.sigla AND d.empresa_id = NEW.id;
END;
