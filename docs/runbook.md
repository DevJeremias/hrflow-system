# Runbook de produção do HRFlow

Produção: https://hrflow.calliari.dev (alias `3.151.3.155.sslip.io` redireciona para ele). Uma instância EC2 t4g.micro
(`i-07ca86dc627e65b3b`, us-east-2, conta `283609055364`, perfil AWS `claude`) com Docker Compose. Os arquivos estão em
[`deploy/`](../deploy/README.md). Não há SSH: a administração é por SSM.

**Último teste de restauração do backup: 2026-10-03** (produção, dump do S3 restaurado em MySQL descartável, contagens
iguais). Refaça a cada trimestre e registre a linha na tabela de [testes registrados](#testes-registrados).

## Acesso à máquina

```bash
# um comando
aws --profile claude --region us-east-2 ssm send-command --instance-ids i-07ca86dc627e65b3b \
  --document-name AWS-RunShellScript --parameters 'commands=["sudo -u ec2-user /opt/hrflow/deploy/compose.sh ps"]'
aws --profile claude --region us-east-2 ssm get-command-invocation --command-id <id> --instance-id i-07ca86dc627e65b3b
# shell (precisa do session-manager-plugin)
aws --profile claude --region us-east-2 ssm start-session --target i-07ca86dc627e65b3b
```

Nos comandos abaixo, "na máquina" quer dizer nesse shell, como `ec2-user` (`sudo -u ec2-user -i`), em `/opt/hrflow/deploy`.
Use `./compose.sh` no lugar de `docker compose`: ele carrega o `.env` e a versão em execução.

## Publicar

**Mesclar uma PR na main é publicar.** Não há passo manual:

1. O CI roda na main. Verde, o `deploy.yml` compila as imagens (arm64) e as envia ao GHCR com a tag igual ao SHA.
2. Em até 2 minutos a máquina (`hrflow-deploy.timer`) vê o CI verde e as imagens, tira um dump, migra, sobe e confere
   `/api/health` (tem de trazer o SHA) e `/api/ready` (200).
3. O job `publicado` do workflow Deploy espera o site dizer que roda o SHA e falha se isso não acontecer em 20 minutos;
   depois exige `/api/ready` em 200 em até 60 s.

Ver o que a máquina fez: `journalctl -u hrflow-deploy.service -n 50 --no-pager` (cada tentativa, cada recusa e cada rollback).
Estado: `cat /opt/hrflow/state/{current-sha,previous-sha,failed-sha}`.

Workflow Deploy vermelho com a versão antiga no ar significa que a máquina não publicou. Causas comuns:

* **Imagem não baixa** (GHCR privado). Os pacotes `hrflow-api` e `hrflow-web` precisam ser públicos (GitHub, Packages,
  Package settings, visibilidade). Se não puderem, faça `docker login ghcr.io` como `ec2-user` com um token de
  leitura de pacotes.
* **Migração ou subida falhou**: a máquina voltou ao SHA anterior sozinha e gravou `failed-sha` (não tenta o mesmo SHA de novo).
  O erro está no journal. Corrija na main com um commit novo.
* **CI vermelho ou ainda rodando**: a máquina espera e não publica.

Republicar à mão (por exemplo depois de apagar `failed-sha` por uma causa externa): `rm /opt/hrflow/state/failed-sha`, e o
próximo ciclo tenta de novo; ou `./update.sh <sha>`. O `workflow_dispatch` do Deploy refaz as imagens de um SHA.

## Voltar a versão anterior

```bash
cd /opt/hrflow/deploy
./rollback.sh            # volta para state/previous-sha
./rollback.sh <sha>      # ou para um SHA específico (40 caracteres) ainda no disco ou no GHCR
```

Leva segundos quando a imagem ainda está na máquina (as 4 últimas versões ficam) e não compila nada. Ele não mexe no
banco: as migrações só acrescentam, então a versão anterior roda sobre o esquema novo. Rodar `rollback.sh` de novo
desfaz o rollback. **Atenção:** depois de um rollback manual, o timer republica a cabeça da main se ela for diferente do
SHA em execução. Para segurar a versão antiga enquanto se corrige, pare o timer: `sudo systemctl stop hrflow-deploy.timer`
e religue com `start` quando a main estiver boa.

Se o esquema do banco é que precisa voltar, restaure o dump `state/dumps/pre-<sha>-*.sql.gz` (próxima seção).

Ensaio registrado (ensaio local, imagens locais, mesmo `update.sh`, `rollback.sh` e `auto-deploy.sh`): publicar uma versão
nova levou 14 s; migração falha, subida que não fica saudável e imagem quebrada voltaram sozinhas à versão anterior em 5 a 12 s;
`rollback.sh <sha>` levou 8 s, bem abaixo de 2 minutos. O ensaio em produção está na tabela
[testes registrados](#testes-registrados).

## Restaurar o banco

Backups: `backup.sh` roda todo dia às 03:30 em Belém (06:30 UTC) pelo `hrflow-backup.timer`: `mysqldump --single-transaction`
(com triggers, rotinas e eventos), `gzip`, validação do marcador `-- Dump completed` e envio ao S3. Destino: bucket
`hrflow-backups-283609055364` (us-east-2, versionamento, AES256, acesso público bloqueado, expira em 30 dias), prefixo
`mysql/`. A máquina só tem `s3:PutObject` nesse prefixo: grava, não lê nem apaga. Quem restaura usa o perfil `claude`.
Além disso, `update.sh` guarda em `state/dumps/` o dump anterior a cada migração (os 5 últimos).

Conferir que o backup roda:

```bash
systemctl list-timers hrflow-backup.timer --no-pager
journalctl -u hrflow-backup.service -n 20 --no-pager        # "backup enviado: s3://..."
aws --profile claude --region us-east-2 s3 ls s3://hrflow-backups-283609055364/mysql/ | tail -3   # um objeto por dia
```

1. **Ensaio**, na estação de trabalho, num MySQL descartável (não toca a produção):
   ```bash
   aws --profile claude --region us-east-2 s3 cp s3://hrflow-backups-283609055364/mysql/<objeto>.sql.gz .
   docker run -d --rm --name hrflow-restore -e MYSQL_ROOT_PASSWORD=restore-dev -p 127.0.0.1:53421:3306 mysql:8.0 --skip-log-bin
   zcat <objeto>.sql.gz | docker exec -i hrflow-restore sh -c 'MYSQL_PWD=restore-dev mysql -uroot'
   docker exec hrflow-restore sh -c 'MYSQL_PWD=restore-dev mysql -uroot -N hrflow_db -e "SELECT COUNT(*) FROM empresas"'
   docker stop hrflow-restore
   ```
   `empresas`, `funcionarios`, `usuarios` e `schema_migrations` têm de bater com a produção no momento do dump.
2. **Restauração real** (perda do volume ou dado corrompido), na máquina, com `.env` no lugar. Pare a API para ninguém gravar durante a restauração:
   ```bash
   cd /opt/hrflow/deploy
   ./compose.sh stop web api
   ./compose.sh up -d --wait mysql
   # o dump traz CREATE DATABASE; se o banco existe e está corrompido, apague-o antes:
   #   ./compose.sh exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "DROP DATABASE hrflow_db"'
   zcat <objeto>.sql.gz | ./compose.sh exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
   ./compose.sh up -d --wait
   curl -s https://hrflow.calliari.dev/api/ready      # {"status":"ok"}
   ```
   O dump só traz o que existia no momento dele: o que entrou depois se perde (RPO de até 24 h; não há recuperação pontual ainda, veja "Próximos passos").
3. **Máquina nova**: criar a instância com `bootstrap-userdata.sh`, colocar o `.env`, `first-deploy.sh <sha>` (não carrega fixtures
   sobre dado real), restaurar como no passo 2, e `sudo ./install-deploy.sh` e `sudo ./install-backup.sh <bucket>`.

### Testes registrados

| Data | Cenário | Resultado |
| --- | --- | --- |
| 2026-10-03 | Ensaio local de `backup.sh` (aws simulado) e restauração em MySQL 8.0 descartável, banco migrado com fixtures | `empresas` 2, `funcionarios` 4, `usuarios` 6, trigger presente: iguais à origem |
| 2026-10-03 | Produção: `backup.sh` real (dump em `s3://hrflow-backups-283609055364/mysql/hrflow-20261003T192528Z.sql.gz`), baixado e restaurado em MySQL 8.0 descartável na própria máquina | `empresas` 2, `funcionarios` 4, `usuarios` 6, `schema_migrations` 11, triggers 1: iguais à produção |
| 2026-10-03 | Ensaio local do deploy por pull: publicar, falha de migração, falha de saúde e `rollback.sh` | publicar 14 s; rollbacks automáticos 5 a 12 s; `rollback.sh <sha>` 8 s |

## Ligar o deploy por pull (uma vez por máquina)

Já feito na produção atual (veja o journal). Numa máquina nova, depois do `first-deploy.sh`:

```bash
sudo /opt/hrflow/deploy/install-deploy.sh      # registra o SHA em execução e habilita hrflow-deploy.timer
systemctl list-timers hrflow-deploy.timer --no-pager
```

Numa máquina que ainda roda imagens compiladas ali (`hrflow-api:latest`), o script as etiqueta com o SHA em execução para
que o rollback da primeira publicação tenha para onde voltar.

## Rotacionar segredos

Os segredos vivem só em `/opt/hrflow/deploy/.env` (modo 600). Nunca cole valores em chat, issue, commit ou log.

**`JWT_SECRET`** (suspeita de vazamento ou rotina): derruba todas as sessões, todo mundo faz login de novo.

```bash
cd /opt/hrflow/deploy
cp -p .env .env.bak                       # apague o .env.bak depois, ele guarda o segredo antigo
novo="$(openssl rand -hex 32)"
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${novo}/" .env; unset novo
./compose.sh up -d --wait api             # recria a API com o valor novo
curl -s https://hrflow.calliari.dev/api/ready
shred -u .env.bak
```

**`DB_PASS`** (senha do usuário da aplicação): o MySQL só lê `MYSQL_PASSWORD` na criação do volume, então é preciso trocar no banco e no `.env`.

```bash
cd /opt/hrflow/deploy; source ./.env     # carrega DB_USER e DB_NAME no shell
novo="$(openssl rand -hex 24)"
printf "ALTER USER '%s'@'%%' IDENTIFIED BY '%s';\n" "$DB_USER" "$novo" \
  | ./compose.sh exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
cp -p .env .env.bak
sed -i "s/^DB_PASS=.*/DB_PASS=${novo}/" .env; unset novo
./compose.sh up -d --wait api
curl -s https://hrflow.calliari.dev/api/ready
shred -u .env.bak
```

Se a API não ficar saudável, o `.env.bak` tem a senha antiga e o `ALTER USER` pode ser desfeito com ela. `MYSQL_ROOT_PASSWORD` segue o mesmo
caminho (`ALTER USER 'root'@'localhost'`), mas o `backup.sh` e o `update.sh` usam o `.env` na hora, então troque os dois juntos.
Fora da máquina, guarde o novo valor no cofre de segredos do dono; a cópia antiga em arquivos de lab deve ser apagada.

## Incidente

1. **O site não abre ou `/api/ready` não é 200.** `./compose.sh ps` e `./compose.sh logs --tail 100 api web mysql` (o Caddy e a API escrevem uma linha JSON por requisição, com o mesmo id em `request_id` e `reqId`).
2. **Começou depois de uma publicação**: `./rollback.sh` e abra a investigação na main. Pare o timer enquanto isso (seção "Voltar a versão anterior").
3. **Banco**: `./compose.sh logs --tail 100 mysql`, espaço em disco (`df -h /`), memória (`free -m`, a máquina tem 1 GiB e 2 GB de swap). Banco corrompido: restaurar.
4. **Máquina não responde ao SSM**: `aws ec2 describe-instance-status` e, se preciso, reiniciar a instância (`aws ec2 reboot-instances`; o Docker sobe no boot e os contêineres têm `restart: unless-stopped`).
5. **Certificado**: o Caddy renova sozinho. Se falhar, `./compose.sh logs web | grep -i tls`. Confira o DNS (A `hrflow.calliari.dev` para `3.151.3.155`) e, se existir, o registro CAA (abaixo).
6. **Suspeita de vazamento de credencial**: rotacione `JWT_SECRET` e `DB_PASS` (seção anterior) e revise o log de acesso.
7. Registre o incidente (o que houve, o que foi feito, o que muda) no vault de conhecimento.

Alarmes e Budget: o Budget `hrflow-mensal-10usd` avisa por e-mail do dono da conta. Ainda não há alarme de `StatusCheckFailed`, memória, disco nem certificado (veja "Próximos passos").

## DNS

* `A hrflow.calliari.dev` para `3.151.3.155` (Elastic IP `eipalloc-0f52c9f34c7cb2223`, TTL 300).
* **CAA** (pendente, no provedor do DNS de `calliari.dev`): `calliari.dev. CAA 0 issue "letsencrypt.org"`. Só a Let's Encrypt, a CA que o Caddy usa, pode emitir certificado para o domínio.
* O alias `3.151.3.155.sslip.io` não precisa de DNS e só redireciona (308) para o nome definitivo.

## Recursos na AWS (us-east-2, conta 283609055364, tag `project=hrflow`)

| Recurso | ID |
| --- | --- |
| Instância EC2 t4g.micro (Amazon Linux 2023 arm64, IMDSv2 obrigatório) | `i-07ca86dc627e65b3b` |
| Volume EBS gp3 20 GB criptografado | `vol-03207d681eb8ae2a7` |
| Elastic IP | `eipalloc-0f52c9f34c7cb2223` (`3.151.3.155`) |
| Security group (só 80 e 443) | `sg-0d76672691478ab65` (`hrflow-web`) |
| Role e instance profile da instância (SSM e `s3:PutObject` em `mysql/*`) | `hrflow-ec2-ssm` |
| Bucket de backup | `hrflow-backups-283609055364` |
| Budget mensal de US$ 10 | `hrflow-mensal-10usd` |

Esses recursos foram criados por CLI e ainda não são código (próximos passos). A organização nega por SCP provedor OIDC
e SAML do IAM; criar role, usuário e Lambda funciona.

## Contatos

* Dono da conta AWS, do domínio `calliari.dev` e do repositório: Daniel Calliari (alertas do Budget chegam por e-mail a ele).
* Repositório: `DevJeremias/hrflow-system` (escrita, sem admin: não há secrets nem proteção de branch configuráveis por quem desenvolve).
* Quem muda DNS (A, CAA) ou a visibilidade dos pacotes do GHCR é o dono.

## Próximos passos conhecidos (não feitos)

* **MySQL 8.4 em produção.** A CI já roda na 8.4 (com `log_bin_trust_function_creators=1` e binlog ligados). A produção segue na 8.0 de
  propósito: a atualização do volume é de mão única (a 8.0 não abre um datadir já atualizado) e não deve coincidir com o primeiro deploy
  por pull. Roteiro: dump manual e cópia do volume; ensaio do dump em `mysql:8.4` descartável; trocar `image:` e acrescentar
  `--log-bin-trust-function-creators=1` e `--binlog-expire-logs-seconds` no `command`; `up -d --wait mysql`; migrar; conferir.
* **Recuperação pontual (PITR).** Exige o binlog (8.4, item acima) e enviar os binlogs ao S3 com mais frequência que o dump diário. Hoje o RPO é de até 24 h.
* **Infraestrutura como código** (CDK ou CloudFormation) para instância, security group, Elastic IP, role, DLM (snapshot do EBS), alarmes
  (`StatusCheckFailed`, memória, disco, certificado) e Budget, com `diff` vazio contra a conta.
* **CAA** no DNS (seção DNS) e alarme para o timer de backup (um dump ausente hoje não avisa ninguém).
