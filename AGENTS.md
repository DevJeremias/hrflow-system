# Memória do projeto

## Estrutura

* `frontend/` contém a aplicação React com Vite.
* `backend/` contém a API Node.js com Express.

O front-end alcança a API por caminhos relativos `/api`, encaminhados pelo proxy do Vite. O alvo padrão é `http://localhost:3000` e pode ser alterado com `VITE_API_PROXY_TARGET`. Não reintroduza hosts fixos no código do front-end.

Todas as chamadas HTTP do front-end passam por `frontend/src/services/httpClient.ts`.

A API requer MySQL. O schema vive em migrations numeradas em `backend/migrations`; `npm run db:setup` na raiz cria o banco do zero, aplica as migrations e carrega fixtures sintéticas (passo a passo no README).

A configuração JWT também tem uma armadilha conhecida: com `JWT_SECRET` vazio, o login emite um token usando um fallback diferente do usado na verificação, e a própria aplicação rejeita esse token.
