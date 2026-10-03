# Memória do projeto

## Estrutura

* `frontend/` contém a aplicação React com Vite.
* `backend/` contém a API Node.js com Express.

O front-end alcança a API por caminhos relativos `/api`, encaminhados pelo proxy do Vite. O alvo padrão é `http://localhost:3000` e pode ser alterado com `VITE_API_PROXY_TARGET`. Não reintroduza hosts fixos no código do front-end.

Todas as chamadas HTTP do front-end passam por `frontend/src/services/httpClient.ts`.

A API requer MySQL. O schema vive em migrations numeradas em `backend/migrations`; `npm run db:setup` na raiz cria o banco do zero, aplica as migrations e carrega fixtures sintéticas (passo a passo no README).

`JWT_SECRET` é obrigatório (mínimo de 32 bytes) e não há fallback: sem ele a API não sobe.

O gerenciador de pacotes é o npm, com um único `package-lock.json` na raiz. O gate de qualidade é `npm run verify` (lint, typecheck, build e testes de backend), que exige um MySQL descartável apontado por `HRFLOW_TEST_DB_HOST`, `HRFLOW_TEST_DB_USER` e `HRFLOW_TEST_DB_PASS`. Commits seguem Conventional Commits (commitlint no CI) e a `main` só recebe PR com o check `verify` verde.
