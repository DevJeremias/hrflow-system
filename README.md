


# HRFlow 🚀

<div align="center">
  <img alt="React" src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" />
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-00000F?style=for-the-badge&logo=mysql&logoColor=white" />
  <br/>
  <b>Status:</b> Em Desenvolvimento (Fase 3 Concluída) 🚧
</div>

<br/>

O **HRFlow** é um Sistema Integrado de Gestão de Recursos Humanos desenhado para modernizar, centralizar e automatizar o ecossistema financeiro e administrativo de empresas, acabando com a dependência de processos manuais e planilhas desconexas.

## 🎯 A Dor e a Solução

**O Problema:** 
Departamentos de Recursos Humanos tradicionais sofrem com a fragmentação de informações. Dados de colaboradores perdem-se em dezenas de arquivos, cálculos de folha de pagamento (como retenções de INSS e encargos) são feitos manualmente – o que gera margem para erros legais e financeiros – e os funcionários não têm autonomia para acessar seus próprios dados de forma centralizada.

**A Solução HRFlow:** 
Construímos uma plataforma web que unifica a jornada do colaborador e da empresa. O sistema gerencia desde a estrutura hierárquica (departamentos e cargos) até ao processamento automático da folha de pagamento através de um motor matemático no back-end. Além disso, disponibiliza um **Portal do Colaborador**, onde cada usuário tem acesso seguro e independente aos seus próprios holerites e informações.

## ⚙️ Arquitetura e Decisões Técnicas

Para garantir escalabilidade e segurança, adotamos uma arquitetura separada (Client-Server):

*   **Front-end (SPA):** Desenvolvido em **React** com **TypeScript** e **Vite**, garantindo uma tipagem estática rigorosa (evitando erros de *runtime*) e um build extremamente rápido. A interface foi construída com **TailwindCSS** para uma estética limpa, responsiva e moderna.
*   **Back-end (API REST):** Construído em **Node.js** com **Express**. Toda a lógica pesada e de negócios (como o cálculo de impostos e ordenados) foi isolada no servidor para evitar manipulações no lado do cliente.
*   **Segurança:** A autenticação e a proteção das rotas são gerenciadas via **JWT (JSON Web Tokens)**, armazenado em um cookie `HttpOnly` que o JavaScript da página não consegue ler, com proteção CSRF nas requisições que alteram dados. O back-end extrai a identidade do usuário diretamente do token, impedindo que um funcionário aceda ao holerite de outro.
*   **Banco de Dados:** **MySQL** relacional. As tabelas são normalizadas para garantir a integridade dos dados, e há proteções contra entradas vazias (ex: tratamento de datas `NULL` via código) para manter o banco blindado contra falhas.

## ✨ Funcionalidades Principais

*   **Gestão Estrutural:** Criação e controle de Departamentos e Cargos (níveis hierárquicos, salários base e gestores).
*   **Core RH (Colaboradores):** cadastro de funcionários com gestão segmentada de dados (Informações Pessoais, Contratuais e Financeiras) e ciclo de vida completo: Férias, inativação ou desligamento com data e motivo (sem perder o histórico de ponto), reativação, redefinição de senha pelo RH e exclusão apenas de cadastro sem movimento.
*   **Folha de Pagamento por competência:** o RH escolhe o mês, processa a folha (INSS e IRRF pelas tabelas vigentes, com dependentes e a redução da Lei 15.270/2025; FGTS e encargos por regime tributário, tudo em centavos; faltas e horas extras vindas do ponto; adiantamento, VT, VR e plano de saúde lançados por colaborador), confere as pendências, baixa os holerites em PDF (individual ou em lote) e fecha o mês. As regras e as fontes estão em `docs/folha-irrf-exemplo-auditado.md`. Folha fechada não muda mais: alterar salário, cargo ou dados da empresa depois não reescreve os holerites já emitidos. PJ e estágio não pagam INSS nem IRRF nem geram FGTS ou encargo CLT; quem está de férias entra na folha; quem foi desligado continua na folha do mês do desligamento e sai a partir do seguinte; quem está sem salário aparece em "pendências".
*   **Dados da empresa:** razão social, CNPJ e regime tributário, mantidos pelo Administrador na tela Empresa. Aparecem no cabeçalho do holerite, e a folha só fecha com razão social e CNPJ preenchidos.
*   **Fuso por empresa:** o Administrador escolhe o fuso da empresa na tela Empresa (padrão Belém). O "dia" do ponto, o "hoje" das justificativas, o mês da folha e o relógio do portal seguem esse fuso, não o do servidor nem o do navegador: uma empresa em Manaus vira o dia uma hora depois da de Belém.
*   **Dashboard e relatórios:** o painel mostra os colaboradores ativos dos últimos 12 meses, admitidos, desligados e turnover do mês, e os aniversariantes; a tela Relatórios (`/admin/relatorios`) traz headcount e turnover por período, custo da folha por departamento (a mesma folha, somada por setor), absenteísmo por departamento e aniversariantes, e exporta cada um em CSV (UTF-8 com BOM, pronto para o Excel brasileiro) e em PDF. Os mesmos relatórios saem em JSON em `GET /api/relatorios/{headcount,aniversariantes,custo-departamento,absenteismo}`.
*   **Notificações:** o sino do cabeçalho avisa o colaborador do holerite disponível (ao fechar a folha) e da decisão de cada justificativa. Com o e-mail configurado (`EMAIL_TRANSPORT`, ver `backend/.env.example`), o mesmo aviso sai por e-mail em pt-BR.
*   **Portal do Colaborador:** Acesso restrito para funcionários visualizarem os seus holerites, um por mês fechado, com a empresa e o CNPJ da época.

## 📂 Estrutura de Diretórios

```text
hrflow-system/
├── e2e/                   # Fluxos de ponta a ponta (Playwright) e a configuração deles
├── scripts/               # dev.mjs, run-workspace.mjs, db.mjs (comandos db:*) e guardar-estrutura.mts (guarda de .js/.jsx)
├── backend/               # API em TypeScript; estrutura e regras em backend/README.md
│   ├── modules/           # Um módulo por área (auth, ponto, dashboard, folha, empresa, perfil, estrutura, funcionarios, saude)
│   ├── shared/            # O que mais de uma área usa: config, db (pool, migrations, fixtures), middlewares, schemas, utils
│   ├── migrations/        # Schema versionado (SQL numerado) e auditorias
│   ├── tests/             # Testes de integração (MySQL descartável) e o apoio deles em tests/support
│   ├── types/             # Declarações de tipos que só o tsc usa (express.d.ts)
│   ├── app.ts             # criarApp: monta o app Express inteiro, sem abrir porta
│   └── server.ts          # Ponto de entrada do Node.js: escuta a porta e encerra limpo no SIGTERM
└── frontend/
    ├── src/
    │   ├── components/    # Componentes React (Admin, Portal, UI)
    │   ├── services/      # Comunicação com a API (fetch)
    │   ├── contexts/      # AuthContext: sessão (hidratada por GET /api/auth/sessao)
    │   ├── utils/         # Validação da sessão e perfis (sessao.ts)
    │   └── App.tsx        # Rotas do Front-end (React Router)
    ├── tests/             # Testes do cliente HTTP e da sessão (node:test, sem navegador)
    ├── vite.config.js
    └── package.json

```

## 🚀 Próximos Passos (Roadmap)

* [x] **Fase 1:** Autenticação e Perfis de Acesso.
* [x] **Fase 2:** Gestão de Colaboradores e Estrutura Organizacional.
* [x] **Fase 3:** Motor Financeiro e Folha de Pagamento Automatizada.
* [ ] **Fase 4:** Relógio de Ponto Eletrônico (parcial: registro de entradas e saídas, apuração diária e mensal contra a jornada do colaborador, e justificativas aprovadas ou recusadas pelo RH já existem; faltam banco de horas, feriados e fechamento do mês). A jornada (`carga_horaria_semanal`, `hora_entrada`, `hora_saida`, `tolerancia_min`) fica em `funcionarios`, com padrão de 40 horas, 08:00 às 17:00 e tolerância de 10 minutos; ainda não há tela para editá-la.
* [x] **Fase 5:** Relatórios em CSV e PDF, Dashboard Analítico, notificações e fuso por empresa. Falta o aviso de férias e afastamentos, que depende do módulo de ausências.

---

## 🛠️ Guia de Configuração e Instalação (Ambiente Local)

Primeira execução em menos de 15 minutos, a partir de um clone novo e sem nenhum arquivo SQL enviado por fora: o banco é criado pelas migrations versionadas em `backend/migrations`.

### Pré-requisitos

* [Node.js](https://nodejs.org/) 22.18.0 ou superior, conforme `.node-version`: o Vite 8 pede 22.12 e o back-end roda TypeScript direto no Node, recurso ligado por padrão a partir da 22.18
* MySQL 8 ou superior. Se não houver um instalado, o caminho mais curto é o [Docker](https://docs.docker.com/get-docker/), usado no passo 2.

### Passo 1: Dependências

Na raiz do repositório, instale as dependências dos dois workspaces com o npm. O `package-lock.json` da raiz é o único lockfile do projeto (o CI usa `npm ci`):

```bash
npm ci
```

### Passo 2: MySQL

Com Docker, suba um MySQL local (troque `hrflow-dev` por outra senha se preferir; o primeiro boot leva cerca de 30 segundos):

```bash
docker run -d --name hrflow-mysql -e MYSQL_ROOT_PASSWORD=hrflow-dev -p 127.0.0.1:3306:3306 mysql:8.0
```

Se a porta 3306 já estiver ocupada, troque o primeiro número do `-p` (por exemplo `-p 127.0.0.1:3307:3306`) e use o mesmo valor em `DB_PORT` no passo 3. Para usar um MySQL que já exista na máquina, pule este comando e aponte o passo 3 para ele; o usuário precisa poder criar bancos e triggers.

Login e cadastro (`/api/auth`) têm corpo limitado a 4 KB e limite de tentativas por IP e por e-mail. Atrás de um proxy reverso, defina `TRUST_PROXY` com o número de proxies (veja `backend/.env.example`); sem isso, todos os clientes dividem o mesmo IP e o mesmo limite.

### Sessão em cookie e proxy reverso

A sessão (8 horas, revogada na troca de senha, na inativação e na exclusão) vive em dois cookies emitidos pelo login e apagados pelo logout (`POST /api/auth/logout`) e por qualquer resposta 401:

| Cookie | Conteúdo | Atributos |
| --- | --- | --- |
| `hrflow_sessao` | o JWT da sessão | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` fora de localhost |
| `hrflow_csrf` | token CSRF derivado do JWT (HMAC com `JWT_SECRET`) | legível pelo front-end, `SameSite=Lax`, `Path=/`, `Secure` fora de localhost |

* O token não vai mais no corpo do login nem no `localStorage`, e `Authorization: Bearer` deixou de ser aceito. O front-end só envia o token CSRF no cabeçalho `X-CSRF-Token` das requisições `POST`, `PUT`, `PATCH` e `DELETE`; sem ele a API responde 403. Leituras (`GET`) não o exigem.
* Quem estava logado com o token antigo no `localStorage` cai uma vez na tela de login, sem erro: o front-end apaga a chave legada ao carregar.
* O cookie é `Secure` quando a requisição chega por HTTPS e, com `NODE_ENV=production`, em qualquer host que não seja loopback. Atrás do Caddy, defina `TRUST_PROXY=1` (veja `backend/.env.example`) para a API enxergar o HTTPS informado em `X-Forwarded-Proto`, e `NODE_ENV=production`.
* Front-end e API precisam ser servidos pela mesma origem, como já acontece: o Vite encaminha `/api` em desenvolvimento e o Caddy faz o mesmo em produção. A API não habilita CORS, de propósito: nenhuma origem externa consegue ler as respostas.
* `POST /api/auth/logout` é público para que uma sessão expirada também consiga limpar os cookies.
* A senha que o RH define no cadastro, ou gera em `POST /api/funcionarios/:id/redefinir-senha`, é provisória (`usuarios.senha_provisoria`). Com ela a sessão só alcança `GET /api/auth/sessao` e `PUT /api/perfil/alterar-senha`; o resto responde 403 até a troca, e o front-end leva a pessoa à tela `/trocar-senha`. A redefinição devolve a senha uma única vez (o banco guarda só o hash) e derruba as sessões abertas. Quem esqueceu a senha pede o link na tela de login (`/esqueci-senha`): com o e-mail configurado (`EMAIL_TRANSPORT`, `EMAIL_FROM` e `APP_URL`, ver `backend/.env.example`), `POST /api/auth/esqueci-senha` manda um e-mail em pt-BR com um token de uso único e validade de 1 hora (guardado só como hash em `redefinicoes_de_senha`) e `POST /api/auth/redefinir-senha` o consome, troca a senha e derruba as sessões abertas. A resposta é a mesma exista ou não a conta; sem e-mail configurado a rota responde 501 e a pessoa procura o RH.

### Cadastro de colaboradores

* O CPF é validado pelos dígitos verificadores, gravado só com os 11 dígitos e único por empresa (a mesma pessoa pode ser colaboradora de duas): repetido na mesma empresa, a API responde 409. O PIS/PASEP, o CEP e a UF também são conferidos. A migration 0016 normaliza os CPFs que já existem e `npm run db:audit` lista antes, só por id, os cadastros que quebrariam as chaves únicas novas (CPF repetido, nome de departamento ou de cargo repetido).
* A edição é `PATCH /api/funcionarios/:id` e muda só os campos enviados (`null` ou texto vazio limpa o campo). `PUT` não existe mais nesta rota.
* Os dependentes ficam em `/api/funcionarios/:id/dependentes` (listar, criar, `PUT` e `DELETE` por dependente) e seguem o alcance sobre o cadastro (veja `docs/permissoes.md`).
* `POST /api/funcionarios/importar` recebe a planilha como texto (`Content-Type: text/csv`, até 2 MB e 500 linhas; vírgula, ponto e vírgula ou tabulação; datas dd/mm/aaaa ou aaaa-mm-dd; salário `3.500,50` ou `3500.50`). Departamento e cargo vão pelo nome. Cada linha vale por si: as válidas são criadas, com senha provisória, e as inválidas voltam com o número da linha e o motivo. As senhas provisórias só existem nessa resposta (`Cache-Control: no-store`).
* O cadastro de empresa (`POST /api/auth/registrar`) exige CNPJ válido e único e a confirmação da senha.

### Monitoramento

Dois endpoints públicos, sem sessão, para monitor e health check de contêiner:

| Endpoint | Pergunta | Resposta |
| --- | --- | --- |
| `GET /api/health` | o processo da API está de pé? Não toca o banco. | `200 {"status":"ok"}` |
| `GET /api/ready` | a API consegue atender? Faz `SELECT 1` com prazo de 2 s. | `200 {"status":"ok"}` ou `503 {"status":"indisponivel"}` |

Rota de API inexistente responde `404 {"erro":"Rota não encontrada."}`. As respostas da API são comprimidas (gzip) e não trazem `X-Powered-By`.

### Logs, falhas e encerramento

* **Uma linha JSON por requisição** em stdout, escrita quando a resposta termina: `reqId`, `metodo`, `rota` (o padrão do Express, como `/api/funcionarios/:id`), `status`, `duracaoMs` e, com a sessão aceita, `usuarioId` e `empresaId`. Nunca o corpo, os cabeçalhos, o cookie nem a query string. `LOG_LEVEL` muda o nível (padrão `info`).
* **`X-Request-Id`**: toda resposta o traz, e é o `reqId` do log. Atrás do Caddy ele é o id que o Caddy gerou (`deploy/Caddyfile`, que também grava `request_id` no log de acesso em JSON), então o mesmo id acompanha a requisição do proxy até o erro.
* **Falha inesperada** (500, ou 503 por infraestrutura) é registrada com o `reqId` e, se `SENTRY_DSN` estiver definida, enviada ao Sentry sem cookie, cabeçalho, corpo nem usuário. Sem `SENTRY_DSN` o SDK nem é carregado.
* **Banco fora do ar** (conexão recusada, `connectTimeout` de 5 s, conexão perdida, limite de conexões do servidor) ou **pool cheio** (`DB_CONNECTION_LIMIT` e `DB_QUEUE_LIMIT`, padrão 10 e 50) respondem `503` com `Retry-After`, em vez de `500`.
* **Encerramento**: `SIGTERM` e `SIGINT` param de aceitar conexões, deixam as requisições em andamento terminarem, fecham o pool e saem; o que passar de 8 s é cortado e o código de saída é 1. Porta ocupada, configuração inválida (`DB_HOST`, `DB_USER`, `DB_NAME`, `DB_PORT`, `PORT`) e promessa rejeitada sem tratamento também terminam o processo com código 1 e a causa no log.
* **Front-end**: toda chamada tem prazo de 30 s e vira o erro de conexão com "Tentar novamente"; uma tela que falha ao desenhar mostra "Algo deu errado" com botão de recarregar e o menu continua visível.

### Passo 3: Variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`: preencha `DB_PASS` com a senha do passo 2 e `JWT_SECRET` com uma chave gerada por `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. `JWT_SECRET` vazio ou com menos de 32 bytes impede a API de subir. As demais variáveis já servem para o MySQL do passo 2.

### Passo 4: Banco de dados

```bash
npm run db:setup
```

O comando cria o banco `DB_NAME`, aplica as migrations e carrega as fixtures sintéticas (duas empresas fictícias, com administrador, RH e colaboradores; todos os dados são inventados). A senha de todos os usuários de teste é `hrflow-dev-123`, ou o valor de `HRFLOW_SEED_PASSWORD` se você o definir antes de rodar. Usuários de teste da empresa Alfa: `admin@alfa.exemplo.invalid` (Administrador), `rita.rh@alfa.exemplo.invalid` (RH) e `caio@alfa.exemplo.invalid` (Colaborador). As fixtures se recusam a rodar com `NODE_ENV=production`.

Os passos podem ser rodados separadamente:

| Comando | O que faz |
| --- | --- |
| `npm run db:create` | cria o banco se ele não existir |
| `npm run db:migrate` | aplica as migrations pendentes (pode rodar quantas vezes quiser) |
| `npm run db:status` | mostra o estado de cada migration |
| `npm run db:audit` | procura dados que violariam as constraints novas, sem alterar nada |
| `npm run db:seed` | carrega as fixtures (não repete se já estiverem carregadas) |
| `npm run db:reset -- --banco=<DB_NAME>` | **apaga o banco inteiro** e refaz tudo; só para desenvolvimento: exige o nome do banco e recusa `DB_HOST` que não seja local |

Regras das migrations:

* Cada arquivo `backend/migrations/NNNN_nome.sql` roda uma vez, em ordem, e fica registrado em `schema_migrations` com um checksum. Uma migration já aplicada nunca é editada: mudanças entram em uma migration nova. Editar uma aplicada faz `db:migrate` recusar.
* O MySQL não faz DDL transacional. Se uma migration falhar no meio de um banco de desenvolvimento, rode `db:reset`.
* A migration `0003` (chaves por empresa para cargo e departamento) tem uma auditoria em `0003_referencias_por_empresa.audit.sql`. Se houver cargo ou colaborador apontando para cargo ou departamento de outra empresa, a migration não é aplicada e lista os ids a corrigir. `db:audit` roda a mesma checagem sem aplicar nada.
* As migrations descrevem um banco criado do zero. Um banco que já existia, criado à mão por um dos SQLs antigos, deve ser auditado com `db:audit` e recriado em um banco novo com `db:setup`, migrando os dados.
* `CREATE TRIGGER` (migration `0002`) exige o privilégio `TRIGGER` do usuário; com log binário ligado, também `SUPER` ou `log_bin_trust_function_creators=1`. O usuário `root` do Docker do passo 2 já tem tudo isso.

### Passo 5: Execução

Os comandos abaixo são executados na raiz. `dev` sobe os dois workspaces; `build`, `lint` e `typecheck` executam as verificações do front-end:

```bash
# Front-end Vite e API Express em modo desenvolvimento
npm run dev

# Verificações do projeto
npm run lint
npm run typecheck
npm run build
```

A API fica em `http://localhost:3000/api` e o Vite informa a URL do front-end no terminal. Também é possível iniciar apenas um workspace com `npm run dev --workspace frontend` ou `npm run dev --workspace backend`. Entre com um dos usuários de teste do passo 4.

### Testes do back-end

Os testes de integração usam um MySQL real e criam, migram e apagam um banco próprio (`hrflow_test_<pid>`), sem tocar em `DB_NAME`. Informe o servidor do passo 2 e rode na raiz:

```bash
HRFLOW_TEST_DB_HOST=127.0.0.1 HRFLOW_TEST_DB_USER=root HRFLOW_TEST_DB_PASS=hrflow-dev npm run test
```

`HRFLOW_TEST_DB_PORT` é opcional (padrão 3306). Sem `HRFLOW_TEST_DB_HOST` os testes são marcados como ignorados, nunca como aprovados.

Os arquivos de teste rodam quatro de cada vez. Antes deles, o `npm test` (`backend/tests/support/executar.ts`) migra um banco molde, e cada arquivo recebe uma cópia dele em vez de reaplicar as migrations; o molde é apagado no fim. Com o MySQL ocioso a suíte do back-end termina em bem menos de 40 s. Para rodar só alguns arquivos, passe-os ao script: `npm test --workspace backend -- tests/pontoRegistro.test.ts`. Um arquivo rodado direto com `node --test` migra o próprio banco.

`npm run test:cobertura` roda os testes do back-end e do front-end com o relatório de cobertura de linhas do back-end (`app.ts`, `server.ts`, `modules/` e `shared/`).

### Testes do front-end

Os testes do cliente HTTP e da validação da sessão rodam no Node, sem banco e sem navegador (`npm run test` na raiz roda o back-end e depois o front-end; `npm run test --workspace frontend` roda só o front-end).

Os testes de componente (`frontend/tests/*Modal.test.ts`, `protectedRoute.test.ts`, `authContext.test.ts`) renderizam o componente de verdade no jsdom com o Testing Library e a API simulada (`tests/support/componentes.ts`). Procure os elementos pelo papel e pelo nome acessível (`getByRole`), como uma pessoa os veria: assim o teste cai quando um modal perde o `role="dialog"`.

### Testes de ponta a ponta (Playwright)

Dois fluxos rodam num navegador de verdade contra a API e o front-end de verdade, num banco criado por `npm run db:setup`: o colaborador entra e marca o ponto, e o RH cadastra um colaborador e o encontra na folha (`e2e/`). Com o MySQL do passo 2 e o `backend/.env` do passo 3 prontos:

```bash
npm run db:setup
npx playwright install chromium   # uma vez
npm run e2e
```

O Playwright sobe a API (porta 3181) e o Vite (porta 3182); `E2E_API_PORT` e `E2E_WEB_PORT` mudam as portas. Os fluxos criam os próprios colaboradores, então rodam de novo sem apagar o banco. No GitHub Actions eles rodam no job `e2e`, que guarda o relatório e os traces quando um fluxo falha.

### Verificação completa (`verify`)

`npm run verify` é o comando que a equipe considera obrigatório antes de abrir ou mesclar um pull request: roda `lint`, `typecheck`, `build` e os testes (back-end e front-end), todas as etapas ao mesmo tempo (cerca de 25 s numa máquina de desenvolvimento, com o MySQL ocioso), mostra a saída de cada uma quando ela termina e termina com erro se qualquer uma falhar. Ele exige as variáveis `HRFLOW_TEST_DB_*` da seção anterior; sem `HRFLOW_TEST_DB_HOST` a etapa de testes falha em vez de passar sem ter rodado, e testes ignorados também reprovam. A etapa de testes também reprova se a cobertura de linhas do back-end ficar abaixo de 90% (`PISO_COBERTURA_LINHAS` em `scripts/verify.mjs`) ou se o relatório de cobertura não vier. Os fluxos de ponta a ponta não fazem parte do `verify`: rodam no job `e2e` do CI.

```bash
HRFLOW_TEST_DB_HOST=127.0.0.1 HRFLOW_TEST_DB_USER=root HRFLOW_TEST_DB_PASS=hrflow-dev npm run verify
```

O mesmo comando roda no GitHub Actions (`.github/workflows/ci.yml`) em todo pull request e em todo push na `main`, com um MySQL de serviço, depois de `db:setup` aplicar as migrations e as fixtures.

O `npm run lint` roda três coisas: a guarda `scripts/guardar-estrutura.mts` (falha se entrar `.js` ou `.jsx` em `backend/` ou `frontend/`, fora das configurações de ferramenta listadas nela), o lint do front-end e o do back-end (fronteiras entre módulos, veja `backend/README.md`). O CI roda a guarda antes de instalar dependências.

Sobre o lint do front-end (`frontend/eslint.config.js`):

* Cobre todo o código ativo, inclusive `.ts` e `.tsx`, com `--max-warnings 0`.
* `eslint-suppressions.json` registra as violações que já existiam de `no-explicit-any` e de algumas regras do React que exigem mudar o comportamento do componente para serem corrigidas. Elas não bloqueiam, mas nenhuma violação nova passa. Ao corrigir uma, rode `npm run lint:prune --workspace frontend` para tirá-la da lista; o lint avisa quando sobra supressão que não ocorre mais.
---

## 👥 Equipe de Desenvolvimento

Sistema desenvolvido e arquitetado por:

* **Henrique Jeremias** ([@devjeremias](https://www.google.com/search?q=https://github.com/devjeremias))
* **Marcos**
* **Yuri**
* **Thalison**
* **Breno**
* **Caique**
* **Henri**
