-- A busca de colaboradores roda no servidor e a listagem sai em ordem alfabética dentro da
-- empresa: o índice atende o filtro por empresa e a ordenação por nome sem filesort.
CREATE INDEX idx_funcionarios_empresa_nome ON funcionarios (empresa_id, nome);
