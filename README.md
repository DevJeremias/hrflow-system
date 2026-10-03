


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
*   **Core RH (Colaboradores):** CRUD completo de funcionários, com gestão segmentada de dados (Informações Pessoais, Contratuais e Financeiras).
*   **Motor de Folha de Pagamento:** Processamento em lote de todos os salários ativos, aplicando automaticamente as tabelas de dedução de impostos (INSS) e calculando o Custo Bruto, Líquido e Encargos Patronais.
*   **Portal do Colaborador:** Acesso restrito para funcionários visualizarem e fazerem o download dos seus holerites em tempo real.

## 📂 Estrutura de Diretórios

```text
hrflow-system/
├── scripts/               # dev.mjs, run-workspace.mjs e db.mjs (comandos db:*)
├── backend/
│   ├── config/            # Conexões de banco de dados (db.js)
│   ├── controllers/       # Lógica de negócio legada (authController)
│   ├── db/                # Aplicador de migrations
│   ├── middlewares/       # Proteções JWT e validação de perfis (Admin/Colaborador)
│   ├── migrations/        # Schema versionado (SQL numerado) e auditorias
│   ├── modules/           # Módulos em TypeScript, um por área (ponto, dashboard, folha, perfil, estrutura, funcionarios); padrão em backend/README.md
│   ├── routes/            # Endpoints da API REST
│   ├── seeds/             # Fixtures sintéticas de desenvolvimento
│   ├── tests/             # Testes de integração (MySQL descartável)
│   ├── types/             # Declarações de tipos que só o tsc usa (express.d.ts)
│   └── server.js          # Ponto de entrada do Node.js
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
* [ ] **Fase 4:** Relógio de Ponto Eletrônico (parcial: registro de entradas e saídas, justificativas e histórico já existem; falta o banco de horas).
* [ ] **Fase 5:** Geração de relatórios em formato PDF e Dashboard Analítico.

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

### Monitoramento

Dois endpoints públicos, sem sessão, para monitor e health check de contêiner:

| Endpoint | Pergunta | Resposta |
| --- | --- | --- |
| `GET /api/health` | o processo da API está de pé? Não toca o banco. | `200 {"status":"ok"}` |
| `GET /api/ready` | a API consegue atender? Faz `SELECT 1` com prazo de 2 s. | `200 {"status":"ok"}` ou `503 {"status":"indisponivel"}` |

Rota de API inexistente responde `404 {"erro":"Rota não encontrada."}`. As respostas da API são comprimidas (gzip) e não trazem `X-Powered-By`.

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
| `npm run db:reset --confirmar` | **apaga o banco inteiro** e refaz tudo; só para desenvolvimento |

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

### Testes do front-end

Os testes do cliente HTTP e da validação da sessão rodam no Node, sem banco e sem navegador (`npm run test` na raiz roda o back-end e depois o front-end; `npm run test --workspace frontend` roda só o front-end).

### Verificação completa (`verify`)

`npm run verify` é o comando que a equipe considera obrigatório antes de abrir ou mesclar um pull request: roda `lint`, `typecheck`, `build` e os testes (back-end e front-end), todas as etapas, e termina com erro se qualquer uma falhar. Ele exige as variáveis `HRFLOW_TEST_DB_*` da seção anterior; sem `HRFLOW_TEST_DB_HOST` a etapa de testes falha em vez de passar sem ter rodado, e testes ignorados também reprovam.

```bash
HRFLOW_TEST_DB_HOST=127.0.0.1 HRFLOW_TEST_DB_USER=root HRFLOW_TEST_DB_PASS=hrflow-dev npm run verify
```

O mesmo comando roda no GitHub Actions (`.github/workflows/ci.yml`) em todo pull request e em todo push na `main`, com um MySQL de serviço, depois de `db:setup` aplicar as migrations e as fixtures.

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
