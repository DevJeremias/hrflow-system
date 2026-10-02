-- Auditoria da migração 0003: devolve uma linha por registro que referencia cargo ou
-- departamento de outra empresa. Só ids, nunca dados pessoais. Vazio significa seguro aplicar.
SELECT 'cargos.departamento_id aponta para departamento de outra empresa' AS violacao, c.id AS registro_id
FROM cargos c
JOIN departamentos d ON d.id = c.departamento_id
WHERE d.empresa_id <> c.empresa_id
UNION ALL
SELECT 'funcionarios.cargo_id aponta para cargo de outra empresa', f.id
FROM funcionarios f
JOIN cargos c ON c.id = f.cargo_id
WHERE c.empresa_id <> f.empresa_id
UNION ALL
SELECT 'funcionarios.departamento_id aponta para departamento de outra empresa', f.id
FROM funcionarios f
JOIN departamentos d ON d.id = f.departamento_id
WHERE d.empresa_id <> f.empresa_id
ORDER BY violacao, registro_id;
