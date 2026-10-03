-- O avatar original continua em usuarios.avatar e funcionarios.avatar, mas as respostas da API
-- deixam de carregá-lo (chegava a 2,7 MB por chamada). A tela mostra a miniatura de 128 px, gerada
-- no upload e servida por GET /api/perfil/avatar; avatar_atualizado_em versiona a URL dela.
ALTER TABLE usuarios
    ADD COLUMN avatar_miniatura MEDIUMBLOB NULL AFTER avatar,
    ADD COLUMN avatar_atualizado_em TIMESTAMP(3) NULL AFTER avatar_miniatura;
