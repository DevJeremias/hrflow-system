-- Auditoria da migração 0005: devolve uma linha por marcação com coordenadas fora do intervalo
-- válido ou com só um dos dois valores. Só ids, nunca coordenadas. Vazio significa seguro aplicar.
SELECT 'registro_pontos tem latitude sem longitude, ou longitude sem latitude' AS violacao, id AS registro_id
FROM registro_pontos
WHERE (latitude IS NULL) <> (longitude IS NULL)
UNION ALL
SELECT 'registro_pontos tem latitude fora de -90 a 90', id
FROM registro_pontos
WHERE latitude NOT BETWEEN -90 AND 90
UNION ALL
SELECT 'registro_pontos tem longitude fora de -180 a 180', id
FROM registro_pontos
WHERE longitude NOT BETWEEN -180 AND 180
ORDER BY violacao, registro_id;
