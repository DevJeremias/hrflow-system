-- Auditoria da migração 0016: devolve uma linha por registro que violaria as chaves únicas novas
-- ou cujo CPF não se reduz a 11 dígitos. Só ids, nunca dados pessoais. Vazio significa seguro aplicar.
-- O CPF é comparado só pelos dígitos, como a migração o grava; vazio vale como ausente.
SELECT 'funcionarios.cpf repetido na mesma empresa' AS violacao, f.id AS registro_id
FROM funcionarios f
JOIN (
    SELECT empresa_id, REGEXP_REPLACE(cpf, '[^0-9]', '') AS cpf_digitos
    FROM funcionarios
    WHERE REGEXP_REPLACE(cpf, '[^0-9]', '') <> ''
    GROUP BY empresa_id, REGEXP_REPLACE(cpf, '[^0-9]', '')
    HAVING COUNT(*) > 1
) repetidos ON repetidos.empresa_id = f.empresa_id AND repetidos.cpf_digitos = REGEXP_REPLACE(f.cpf, '[^0-9]', '')
UNION ALL
SELECT 'funcionarios.cpf não tem 11 dígitos', id
FROM funcionarios
WHERE cpf IS NOT NULL
  AND REGEXP_REPLACE(cpf, '[^0-9]', '') <> ''
  AND REGEXP_REPLACE(cpf, '[^0-9]', '') NOT REGEXP '^[0-9]{11}$'
UNION ALL
SELECT 'departamentos.nome repetido na mesma empresa', d.id
FROM departamentos d
JOIN (
    SELECT empresa_id, TRIM(nome) AS nome_limpo
    FROM departamentos
    GROUP BY empresa_id, TRIM(nome)
    HAVING COUNT(*) > 1
) repetidos ON repetidos.empresa_id = d.empresa_id AND repetidos.nome_limpo = TRIM(d.nome)
UNION ALL
SELECT 'cargos.nome repetido no mesmo departamento', c.id
FROM cargos c
JOIN (
    SELECT empresa_id, departamento_id, TRIM(nome) AS nome_limpo
    FROM cargos
    WHERE departamento_id IS NOT NULL
    GROUP BY empresa_id, departamento_id, TRIM(nome)
    HAVING COUNT(*) > 1
) repetidos ON repetidos.empresa_id = c.empresa_id AND repetidos.departamento_id = c.departamento_id AND repetidos.nome_limpo = TRIM(c.nome)
ORDER BY violacao, registro_id;
