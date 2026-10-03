-- PERF-01: a listagem de ponto da empresa filtra por empresa e por mês e ordena pela data da
-- marcação. O único índice com data_hora_oficial (0005) começa por funcionario_id e não serve a
-- essa consulta, que lia e ordenava (filesort) todo o histórico da empresa.

CREATE INDEX idx_registro_pontos_empresa_data ON registro_pontos (empresa_id, data_hora_oficial);
