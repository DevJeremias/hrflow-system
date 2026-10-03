// O avatar não viaja nas respostas: elas trazem só o endereço da miniatura (GET /api/perfil/avatar).
// `v` é o instante do último upload em milissegundos (0 para o avatar anterior à miniatura) e muda a
// URL quando a foto muda, para o navegador não servir a antiga do cache.
export const CAMINHO_DO_AVATAR = '/api/perfil/avatar';

// Trecho de SELECT que devolve a URL (ou NULL, sem avatar) sem ler a coluna do avatar, que pesa
// megabytes. `alias` é o da tabela usuarios na consulta.
export const urlDoAvatarSql = (alias: string): string =>
    `IF(${alias}.avatar IS NULL, NULL, CONCAT('${CAMINHO_DO_AVATAR}?v=', COALESCE(CAST(UNIX_TIMESTAMP(${alias}.avatar_atualizado_em) * 1000 AS UNSIGNED), 0)))`;
