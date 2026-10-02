-- Usuários cujo funcionário vinculado pertence a outra empresa não podem receber a FK composta.
-- Retorna somente o id do usuário, sem dados pessoais.
SELECT 'usuarios.funcionario_id pertence a outra empresa' AS violacao, u.id AS registro_id
FROM usuarios u
JOIN funcionarios f ON f.id = u.funcionario_id
WHERE f.empresa_id <> u.empresa_id
ORDER BY u.id;
