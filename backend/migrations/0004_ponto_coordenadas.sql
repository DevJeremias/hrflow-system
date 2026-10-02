-- PONTO-01: o banco passa a recusar coordenadas impossíveis e pares incompletos em registro_pontos.
-- latitude e longitude já existiam como colunas, mas nada as impedia de guardar 400 graus ou só
-- um dos dois valores. NULL nos dois continua permitido: marcações antigas e clientes sem GPS.
-- O índice atende a consulta do dia e do mês de um colaborador, e o bloqueio da sequência de marcações.
-- Antes de aplicar, 0004_ponto_coordenadas.audit.sql procura linhas que violariam.
-- CHECK só é aplicado a partir do MySQL 8.0.16.

ALTER TABLE registro_pontos ADD CONSTRAINT ck_registro_pontos_coordenadas CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude BETWEEN -90 AND 90
        AND longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_registro_pontos_funcionario_data ON registro_pontos (funcionario_id, data_hora_oficial);
