


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
Departamentos de Recursos Humanos tradicionais sofrem com a fragmentação de informações. Dados de colaboradores perdem-se em dezenas de ficheiros, cálculos de folha de pagamento (como retenções de INSS e encargos) são feitos manualmente – o que gera margem para erros legais e financeiros – e os funcionários não têm autonomia para aceder aos seus próprios dados de forma centralizada.

**A Solução HRFlow:** 
Construímos uma plataforma web que unifica a jornada do colaborador e da empresa. O sistema gere desde a estrutura hierárquica (departamentos e cargos) até ao processamento automático da folha de pagamento através de um motor matemático no back-end. Além disso, disponibiliza um **Portal do Colaborador**, onde cada utilizador tem acesso seguro e independente aos seus próprios holerites e informações.

## ⚙️ Arquitetura e Decisões Técnicas

Para garantir escalabilidade e segurança, adotamos uma arquitetura separada (Client-Server):

*   **Front-end (SPA):** Desenvolvido em **React** com **TypeScript** e **Vite**, garantindo uma tipagem estática rigorosa (evitando erros de *runtime*) e um build extremamente rápido. A interface foi construída com **TailwindCSS** para uma estética limpa, responsiva e moderna.
*   **Back-end (API REST):** Construído em **Node.js** com **Express**. Toda a lógica pesada e de negócios (como o cálculo de impostos e ordenados) foi isolada no servidor para evitar manipulações no lado do cliente.
*   **Segurança:** A autenticação e a proteção das rotas são geridas via **JWT (JSON Web Tokens)**. O back-end extrai a identidade do utilizador diretamente do token, impedindo que um funcionário aceda ao holerite de outro.
*   **Base de Dados:** **MySQL** relacional. Estruturámos as tabelas de forma normalizada para garantir a integridade dos dados e implementámos proteções contra entradas vazias (ex: tratamento de datas `NULL` via código) para manter a base de dados blindada contra crashes.

## ✨ Funcionalidades Principais

*   **Gestão Estrutural:** Criação e controlo de Departamentos e Cargos (níveis hierárquicos, salários base e gestores).
*   **Core RH (Colaboradores):** CRUD completo de funcionários, com gestão segmentada de dados (Informações Pessoais, Contratuais e Financeiras).
*   **Motor de Folha de Pagamento:** Processamento em lote de todos os salários ativos, aplicando automaticamente as tabelas de dedução de impostos (INSS) e calculando o Custo Bruto, Líquido e Encargos Patronais.
*   **Portal do Colaborador:** Acesso restrito para funcionários visualizarem e fazerem o download dos seus holerites em tempo real.

## 📂 Estrutura de Diretórios

```text
hrflow-system/
├── scripts/               # dev.mjs, run-workspace.mjs e db.mjs (comandos db:*)
├── backend/
│   ├── config/            # Conexões de banco de dados (db.js)
│   ├── controllers/       # Lógica de negócio (folhaController, funcionarioController)
│   ├── db/                # Aplicador de migrations
│   ├── middlewares/       # Proteções JWT e validação de perfis (Admin/Colaborador)
│   ├── migrations/        # Schema versionado (SQL numerado) e auditorias
│   ├── routes/            # Endpoints da API REST
│   ├── seeds/             # Fixtures sintéticas de desenvolvimento
│   ├── tests/             # Testes de integração (MySQL descartável)
│   └── server.js          # Ponto de entrada do Node.js
└── frontend/
    ├── src/
    │   ├── components/    # Componentes React (Admin, Portal, UI)
    │   ├── services/      # Comunicação com a API (fetch)
    │   ├── AuthContext.tsx# Gestão de estado global de Autenticação
    │   └── App.tsx        # Rotas do Front-end (React Router)
    ├── vite.config.ts
    └── package.json

```

## 🚀 Próximos Passos (Roadmap)

* [x] **Fase 1:** Autenticação e Perfis de Acesso.
* [x] **Fase 2:** Gestão de Colaboradores e Estrutura Organizacional.
* [x] **Fase 3:** Motor Financeiro e Folha de Pagamento Automatizada.
* [ ] **Fase 4:** Relógio de Ponto Eletrónico (Registo de Entradas/Saídas e Banco de Horas).
* [ ] **Fase 5:** Geração de relatórios em formato PDF e Dashboard Analítico.

---

## 🛠️ Guia de Configuração e Instalação (Ambiente Local)

Primeira execução em menos de 15 minutos, a partir de um clone novo e sem nenhum arquivo SQL enviado por fora: o banco é criado pelas migrations versionadas em `backend/migrations`.

### Pré-requisitos

* [Node.js](https://nodejs.org/) 22.12.0 ou superior, conforme `.node-version` e a exigência do Vite 8
* [Bun](https://bun.sh/) para a instalação recomendada (o npm continua suportado)
* MySQL 8 ou superior. Se não houver um instalado, o caminho mais curto é o [Docker](https://docs.docker.com/get-docker/), usado no passo 2.

### Passo 1: Dependências

Na raiz do repositório, instale as dependências dos dois workspaces. O caminho recomendado usa Bun:

```bash
bun install
```

O npm também continua disponível: `npm install --workspaces`.

### Passo 2: MySQL

Com Docker, suba um MySQL local (troque `hrflow-dev` por outra senha se preferir; o primeiro boot leva cerca de 30 segundos):

```bash
docker run -d --name hrflow-mysql -e MYSQL_ROOT_PASSWORD=hrflow-dev -p 127.0.0.1:3306:3306 mysql:8.0
```

Se a porta 3306 já estiver ocupada, troque o primeiro número do `-p` (por exemplo `-p 127.0.0.1:3307:3306`) e use o mesmo valor em `DB_PORT` no passo 3. Para usar um MySQL que já exista na máquina, pule este comando e aponte o passo 3 para ele; o usuário precisa poder criar bancos e triggers.

### Passo 3: Variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`: preencha `DB_PASS` com a senha do passo 2 e `JWT_SECRET` com uma chave gerada por `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. `JWT_SECRET` vazio impede a API de subir. As demais variáveis já servem para o MySQL do passo 2.

### Passo 4: Banco de dados

```bash
bun run db:setup
```

O comando cria o banco `DB_NAME`, aplica as migrations e carrega as fixtures sintéticas (duas empresas fictícias, com administrador, RH e colaboradores; todos os dados são inventados). A senha de todos os usuários de teste é `hrflow-dev-123`, ou o valor de `HRFLOW_SEED_PASSWORD` se você o definir antes de rodar. Usuários de teste da empresa Alfa: `admin@alfa.exemplo.invalid` (Administrador), `rita.rh@alfa.exemplo.invalid` (RH) e `caio@alfa.exemplo.invalid` (Colaborador). As fixtures se recusam a rodar com `NODE_ENV=production`.

Os passos podem ser rodados separadamente:

| Comando | O que faz |
| --- | --- |
| `bun run db:create` | cria o banco se ele não existir |
| `bun run db:migrate` | aplica as migrations pendentes (pode rodar quantas vezes quiser) |
| `bun run db:status` | mostra o estado de cada migration |
| `bun run db:audit` | procura dados que violariam as constraints novas, sem alterar nada |
| `bun run db:seed` | carrega as fixtures (não repete se já estiverem carregadas) |
| `bun run db:reset --confirmar` | **apaga o banco inteiro** e refaz tudo; só para desenvolvimento |

Regras das migrations:

* Cada arquivo `backend/migrations/NNNN_nome.sql` roda uma vez, em ordem, e fica registrado em `schema_migrations` com um checksum. Uma migration já aplicada nunca é editada: mudanças entram em uma migration nova. Editar uma aplicada faz `db:migrate` recusar.
* O MySQL não faz DDL transacional. Se uma migration falhar no meio de um banco de desenvolvimento, rode `db:reset`.
* A migration `0003` (chaves por empresa para cargo e departamento) tem uma auditoria em `0003_referencias_por_empresa.audit.sql`. Se houver cargo ou colaborador apontando para cargo ou departamento de outra empresa, a migration não é aplicada e lista os ids a corrigir. `db:audit` roda a mesma checagem sem aplicar nada.
* As migrations descrevem um banco criado do zero. Um banco que já existia, criado à mão por um dos SQLs antigos, deve ser auditado com `db:audit` e recriado em um banco novo com `db:setup`, migrando os dados.
* `CREATE TRIGGER` (migration `0002`) exige o privilégio `TRIGGER` do usuário; com log binário ligado, também `SUPER` ou `log_bin_trust_function_creators=1`. O usuário `root` do Docker do passo 2 já tem tudo isso.

### Passo 5: Execução

Os comandos abaixo são executados na raiz. `dev` sobe os dois workspaces; `build`, `lint` e `verify` executam as verificações disponíveis atualmente no front-end:

```bash
# Front-end Vite e API Express em modo desenvolvimento
bun run dev

# Verificações do projeto
bun run build
bun run lint
bun run verify
```

Para usar npm, substitua `bun run` por `npm run`. A API fica em `http://localhost:3000/api` e o Vite informa a URL do front-end no terminal. Também é possível iniciar apenas um workspace com `npm run dev --workspace frontend` ou `npm run dev --workspace backend`. Entre com um dos usuários de teste do passo 4.

### Testes do back-end

Os testes de integração usam um MySQL real e criam, migram e apagam um banco próprio (`hrflow_test_<pid>`), sem tocar em `DB_NAME`. Informe o servidor do passo 2 e rode na raiz:

```bash
HRFLOW_TEST_DB_HOST=127.0.0.1 HRFLOW_TEST_DB_USER=root HRFLOW_TEST_DB_PASS=hrflow-dev bun run test
```

`HRFLOW_TEST_DB_PORT` é opcional (padrão 3306). Sem `HRFLOW_TEST_DB_HOST` os testes são marcados como ignorados, nunca como aprovados.

---

## 👥 Equipa de Desenvolvimento

Sistema desenvolvido e arquitetado por:

* **Henrique Jeremias** ([@devjeremias](https://www.google.com/search?q=https://github.com/devjeremias))
* **Marcos**
* **Yuri**
* **Thalison**
* **Breno**
* **Caique**
* **Henri**

```
