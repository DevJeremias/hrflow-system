-- B-22: LGPD. (1) A foto deixa de ser texto base64 em usuarios e funcionarios (até 2,7 MB por linha, em
-- duas tabelas): vai para `avatares` como binário, com o tipo da imagem e a miniatura de 128 px, e as
-- colunas antigas são apagadas depois da cópia. funcionarios.avatar era só um espelho de usuarios.avatar
-- (o perfil gravava nos dois), então não há o que copiar dele. (2) funcionarios.anonimizado_em marca o
-- cadastro cujos dados pessoais foram apagados a pedido do titular (docs/lgpd.md). (3) empresas
-- guarda o encarregado pelo tratamento de dados que a controladora indica (art. 41 da LGPD).
CREATE TABLE avatares (
    usuario_id INT PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL,
    imagem MEDIUMBLOB NOT NULL,
    miniatura MEDIUMBLOB NULL,
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_avatares_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- O data URL tem a forma data:image/png;base64,<dados>. Um valor que não decodifica fica de fora.
INSERT INTO avatares (usuario_id, tipo, imagem, miniatura, atualizado_em)
SELECT id,
       SUBSTRING_INDEX(SUBSTRING_INDEX(avatar, ';', 1), ':', -1),
       FROM_BASE64(SUBSTRING(avatar, LOCATE(',', avatar) + 1)),
       avatar_miniatura,
       COALESCE(avatar_atualizado_em, CURRENT_TIMESTAMP(3))
FROM usuarios
WHERE avatar IS NOT NULL AND FROM_BASE64(SUBSTRING(avatar, LOCATE(',', avatar) + 1)) IS NOT NULL;

ALTER TABLE usuarios DROP COLUMN avatar, DROP COLUMN avatar_miniatura, DROP COLUMN avatar_atualizado_em;

ALTER TABLE funcionarios
    DROP COLUMN avatar,
    ADD COLUMN anonimizado_em TIMESTAMP NULL AFTER motivo_desligamento;

ALTER TABLE empresas
    ADD COLUMN encarregado_nome VARCHAR(255) NULL,
    ADD COLUMN encarregado_email VARCHAR(255) NULL;
