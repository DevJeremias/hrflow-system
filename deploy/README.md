# Deploy do HRFlow

Tudo que roda em produção está versionado aqui. Procedimentos de operação (publicar, voltar versão, restaurar,
rotacionar segredos, incidente) estão em [`docs/runbook.md`](../docs/runbook.md).

## Como uma publicação acontece

```
PR mesclada na main
  └─ CI (ci.yml) verde na main
       ├─ deploy.yml: compila hrflow-api e hrflow-web (arm64) e envia ao GHCR com a tag igual ao SHA
       │              e espera https://hrflow.calliari.dev dizer que roda esse SHA (falha em 20 min)
       └─ na máquina, hrflow-deploy.timer (a cada 2 min) roda auto-deploy.sh:
            CI do SHA = success? imagens do SHA no GHCR? SHA diferente do que roda?
            └─ update.sh <sha>: dump → migrate → up --wait → /api/health com o SHA e /api/ready em 200
                 └─ falhou? rollback.sh para o SHA anterior e erro (o workflow fica vermelho)
```

A máquina não recebe comando do GitHub. A organização da conta AWS nega por SCP a criação de provedor OIDC do IAM
(`iam:CreateOpenIDConnectProvider`), então não existe role assumida pelo GitHub nem secret no repositório: a máquina é
quem puxa. Ela só lê o GitHub público (cabeça da main, resultado do CI) e o GHCR.

## Arquivos

| Arquivo | Para quê |
| --- | --- |
| `api.Dockerfile`, `web.Dockerfile` | Imagens. O contexto de build é a raiz do repositório (`.dockerignore` na raiz). A `web` leva a SPA compilada e o `Caddyfile` |
| `Caddyfile` | Proxy e SPA: `/api` vai à API; arquivo que existe é servido; caminho sem extensão que não é arquivo volta `index.html` (rota nova do React não exige mexer aqui); asset inexistente e `/api` desconhecido dão 404. Redireciona o alias `sslip.io` ao nome definitivo, fixa h1 e h2, cabeçalhos de segurança e log JSON com `request_id` |
| `docker-compose.yml` | mysql (8.0), api e web. Imagens `ghcr.io/devjeremias/hrflow-{api,web}:${IMAGE_TAG}` |
| `lib.sh`, `compose.sh` | Funções comuns (lock, dump, caminhos) e o `docker compose` já com `.env` e a versão em execução: use `./compose.sh ps` |
| `update.sh <sha>` | Publica o SHA. Não contém `docker compose build`: a máquina não compila |
| `rollback.sh [sha]` | Volta as imagens para o SHA (padrão: o anterior), sem baixar nada se a imagem ainda está na máquina. Não mexe no banco |
| `auto-deploy.sh`, `hrflow-deploy.{service,timer}` | O deploy por pull |
| `install-deploy.sh` | Liga o deploy por pull (uma vez, como root) |
| `backup.sh`, `install-backup.sh`, `hrflow-backup.{service,timer}` | Backup diário do MySQL para o S3 |
| `first-deploy.sh`, `seed.sh`, `bootstrap-userdata.sh` | Máquina nova (Docker, swap, rotação de logs) e fixtures só de homologação |
| `.env.example` | Variáveis do `.env` da máquina. O `.env` real nunca vai para o git |

## Layout na máquina (`/opt/hrflow`)

* `deploy/`: estes arquivos, copiados do commit publicado por `update.sh` (que nunca toca `.env` nem `backup.env`).
* `repo/`: clone da main, usado só para ler os arquivos de deploy do commit (`git archive`) e conferir que o SHA está na main.
* `state/`: `release.env` (a `IMAGE_TAG` em execução), `current-sha`, `previous-sha`, `failed-sha`, `dumps/pre-<sha>-*.sql.gz`
  (os 5 últimos, tirados antes de cada migração) e o lock.

## Segredos

Só `deploy/.env` (modo 600, dono `ec2-user`) na máquina. Nada de segredo no repositório, nas imagens, nos logs do CI
nem nos arquivos de `state/`. Um token somente de leitura do GitHub é opcional (`deploy/github.token`), só se o limite
anônimo da API apertar.
