// O avatar não viaja nas respostas: elas trazem só o endereço da miniatura (GET /api/perfil/avatar).
// `v` é o instante do último upload em milissegundos e muda a URL quando a foto muda, para o navegador
// não servir a antiga do cache. A imagem original e a miniatura vivem em `avatares` (binário).
export const CAMINHO_DO_AVATAR = '/api/perfil/avatar';

// Trecho de SELECT que devolve a URL (ou NULL, sem avatar) sem ler a imagem, que pesa megabytes.
// `alias` é o da tabela usuarios na consulta.
export const urlDoAvatarSql = (alias: string): string =>
    `(SELECT CONCAT('${CAMINHO_DO_AVATAR}?v=', CAST(UNIX_TIMESTAMP(a.atualizado_em) * 1000 AS UNSIGNED)) FROM avatares a WHERE a.usuario_id = ${alias}.id)`;
